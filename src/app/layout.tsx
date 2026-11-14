import type { Metadata, Viewport } from "next";
import { Inter, Montserrat, Playfair_Display, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { saasBrand } from "@/config/saas-brand";
import "./globals.css";

// SaaS ComandaZero: Montserrat (títulos) + Inter (UI, dados, preços).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600", "700"], display: "swap" });
// Lojas (white-label): título serifado artesanal ou moderno, escolhido pelo lojista.
const serif = Playfair_Display({ variable: "--font-display-serif", subsets: ["latin"], display: "swap" });
const display = Space_Grotesk({ variable: "--font-display-sans", subsets: ["latin"], display: "swap" });

// Metadados do SaaS. Páginas /loja/[slug] sobrescrevem título, ícones e manifesto com os da loja.
export const metadata: Metadata = {
  title: { default: `${saasBrand.name} · ${saasBrand.slogan}`, template: `%s · ${saasBrand.name}` },
  description: saasBrand.description,
  applicationName: saasBrand.name,
  icons: {
    icon: [
      { url: saasBrand.assets.favicon, sizes: "any" },
      { url: saasBrand.assets.favicon32, sizes: "32x32", type: "image/png" },
    ],
    apple: saasBrand.assets.appleTouchIcon,
  },
  openGraph: { title: saasBrand.name, description: `${saasBrand.slogan} ${saasBrand.description}`, images: [saasBrand.assets.pwa512], locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = { themeColor: saasBrand.palette.navy, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable} ${serif.variable} ${display.variable}`}>
      <body>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-[#0b1f40]">
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
