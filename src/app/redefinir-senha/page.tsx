import { ResetPassword } from "./reset-password";

export const metadata = { title: "Definir nova senha", robots: { index: false, follow: false } };

export default function Page() {
  return <ResetPassword />;
}
