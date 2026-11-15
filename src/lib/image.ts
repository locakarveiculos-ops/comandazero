"use client";

/** Reduz a foto (lado máximo e qualidade) e devolve data URL WebP (ou JPEG se o navegador não gerar WebP). */
export async function fileToDataUrl(file: File, maxSide = 900, quality = 0.78): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem (JPG, PNG ou WebP).");
  if (file.size > 12_000_000) throw new Error("Imagem acima de 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

/** Converte a data URL reduzida de volta em arquivo, para enviar ao Storage já leve (loja real). */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/webp";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], `${name}.${mime === "image/jpeg" ? "jpg" : "webp"}`, { type: mime });
}
