// Gerador de BR Code (Pix estático) conforme o Manual de Padrões para Iniciação do Pix do BCB.
// Em produção o payload dinâmico vem do gateway; aqui serve para a demonstração e para o modo "Pix chave própria".

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const clean = (v: string, max: number) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .toUpperCase()
    .slice(0, max)
    .trim();

export function buildPixPayload(opts: { key: string; name: string; city: string; amount?: number; txid?: string; description?: string }) {
  const gui = field("00", "br.gov.bcb.pix");
  const key = field("01", opts.key);
  const desc = opts.description ? field("02", opts.description.slice(0, 40)) : "";
  const txid = (opts.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const parts = [
    field("00", "01"),
    field("26", gui + key + desc),
    field("52", "0000"),
    field("53", "986"),
    opts.amount && opts.amount > 0 ? field("54", opts.amount.toFixed(2)) : "",
    field("58", "BR"),
    field("59", clean(opts.name, 25) || "LOJA"),
    field("60", clean(opts.city, 15) || "BRASIL"),
    field("62", field("05", txid)),
  ].join("");
  const toSign = `${parts}6304`;
  return toSign + crc16(toSign);
}
