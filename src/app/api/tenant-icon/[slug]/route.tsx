import { ImageResponse } from "next/og";

/**
 * Ícone PWA de loja que ainda não enviou ícone próprio: inicial da loja sobre a cor da loja.
 * Garante que o app instalado mostre a marca do estabelecimento, nunca a da ComandaZero.
 */
const HEX = /^#[0-9a-fA-F]{6}$/;

function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.55 ? "#111111" : "#FFFFFF";
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const size = q.get("size") === "512" ? 512 : 192;
  const color = HEX.test(q.get("c") || "") ? q.get("c")! : "#444444";
  const letter = (q.get("n") || "?").trim().charAt(0).toUpperCase() || "?";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color, color: ink(color), fontSize: size * 0.5, fontWeight: 700 }}>
        {letter}
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=86400" } },
  );
}
