import Forbidden from "../forbidden";

export const metadata = { title: "Acesso não permitido", robots: { index: false, follow: false } };

/** Página servida pelo proxy com status 403 (sem vínculo com a loja ou sem ser admin). */
export default function Page() {
  return <Forbidden />;
}
