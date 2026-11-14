import { Suspense } from "react";
import { AuthScreen } from "./auth-screen";

export const metadata = { title: "Entrar" };

export default function Page() {
  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
