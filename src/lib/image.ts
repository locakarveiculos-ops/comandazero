"use client";

/** Reduz a foto enviada para caber no armazenamento do navegador (Fase 2: upload para o Supabase Storage). */
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
