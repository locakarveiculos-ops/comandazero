import { PanelShell } from "./panel-shell";

export const metadata = { title: "Painel do lojista", manifest: "/api/manifest/saas" };

export default async function Layout({ children, params }: LayoutProps<"/painel/[slug]">) {
  const { slug } = await params;
  return <PanelShell slug={slug}>{children}</PanelShell>;
}
