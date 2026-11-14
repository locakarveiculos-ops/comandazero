import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Criar minha loja", robots: { index: false, follow: false } };

/** Onboarding da conta nova: 5 passos até a loja no ar, com 14 dias de teste grátis. Nunca cai na loja demo. */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/entrar?modo=cadastro&next=%2Fonboarding");
  const meta = (user.user_metadata ?? {}) as { whatsapp?: string };
  return <OnboardingWizard defaultWhatsapp={meta.whatsapp?.replace(/^55/, "") ?? ""} />;
}
