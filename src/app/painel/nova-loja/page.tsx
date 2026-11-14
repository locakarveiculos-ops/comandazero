import { redirect } from "next/navigation";

export const metadata = { title: "Criar minha loja", robots: { index: false, follow: false } };

/** Endereço antigo do onboarding (links de e-mail e favoritos): segue para o assistente de 5 passos. */
export default function Page() {
  redirect("/onboarding");
}
