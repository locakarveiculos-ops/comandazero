import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { NewStoreForm } from "./new-store-form";

export const metadata = { title: "Criar minha loja", robots: { index: false, follow: false } };

/** Onboarding: conta nova cria a própria loja (nunca cai na loja demo). */
export default async function Page() {
  if (!(await getUser())) redirect("/entrar?modo=cadastro&next=%2Fpainel%2Fnova-loja");
  return <NewStoreForm />;
}
