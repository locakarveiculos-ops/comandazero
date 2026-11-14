import { Tracking } from "./tracking";

export const metadata = { title: "Acompanhar pedido" };

export default async function Page({ params }: PageProps<"/loja/[slug]/pedido/[id]">) {
  const { slug, id } = await params;
  return <Tracking slug={slug} id={id} />;
}
