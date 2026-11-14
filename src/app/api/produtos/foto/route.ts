import { z } from "zod";
import { HttpError, errorResponse, json, rateLimit } from "@/lib/server/http";
import { can, getTenantAccess, getUser } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/produtos/foto (multipart: slug, file) — foto de produto no Supabase Storage.
 * Valida papel (dono/gerente), tipo pelo conteúdo (não só pela extensão) e tamanho; grava em <tenant_id>/<uuid>.<ext>.
 * O bucket também restringe tipo (webp/jpeg/png) e 2 MB, e a policy só aceita membros owner/manager da loja.
 */
const MAX = 2 * 1024 * 1024;
const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", ext: "webp", test: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
];

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) throw new HttpError(401, "Entre na sua conta.");
    rateLimit(`foto:${user.id}`, 30, 60_000);
    const form = await req.formData();
    const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/).safeParse(form.get("slug"));
    const file = form.get("file");
    if (!slug.success || !(file instanceof File)) throw new HttpError(400, "Envie a loja e a imagem.");
    if (file.size > MAX) throw new HttpError(413, "Imagem acima de 2 MB.");
    const access = await getTenantAccess(slug.data);
    if (!access || access.isDemo) throw new HttpError(400, "Loja de demonstração guarda a foto no navegador.");
    if (!can(access.role, "menu.edit")) throw new HttpError(403, "Sua função não permite alterar o cardápio.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sig = SIGNATURES.find((s) => s.test(bytes));
    if (!sig) throw new HttpError(415, "Formato não aceito. Use JPG, PNG ou WebP.");
    const path = `${access.id}/${crypto.randomUUID()}.${sig.ext}`;
    const sb = await supabaseServer();
    const { error } = await sb.storage.from("product-images").upload(path, bytes, { contentType: sig.mime, upsert: false, cacheControl: "31536000" });
    if (error) throw new HttpError(400, `Falha no upload: ${error.message}`);
    const { data } = sb.storage.from("product-images").getPublicUrl(path);
    return json({ url: data.publicUrl, path }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
