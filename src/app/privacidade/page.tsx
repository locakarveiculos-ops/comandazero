import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COMPANY, PRIVACY_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a ComandaZero trata dados pessoais de lojistas e clientes, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
};

export default function Page() {
  return (
    <LegalPage title="Política de Privacidade" version={PRIVACY_VERSION}>
      <p>Esta Política explica quais dados pessoais a {COMPANY.name} trata, para quê, com quem compartilha e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <h2>1. Papéis</h2>
      <ul>
        <li>
          <b>Dados do lojista e da equipe</b> (nome, e-mail, WhatsApp, acessos): a {COMPANY.name} é a controladora.
        </li>
        <li>
          <b>Dados dos clientes da loja</b> (nome, telefone, endereço e pedidos): o lojista é o controlador e a {COMPANY.name} é a operadora, tratando os dados só para fazer o pedido funcionar.
        </li>
      </ul>

      <h2>2. Quais dados e para quê</h2>
      <ul>
        <li>
          <b>Cadastro do lojista:</b> criar e proteger a conta, cobrar a assinatura e avisar sobre o serviço (execução de contrato).
        </li>
        <li>
          <b>Pedido do cliente:</b> nome e WhatsApp para identificar e avisar sobre o pedido; endereço só quando há entrega (execução de contrato com a loja).
        </li>
        <li>
          <b>Registros de acesso:</b> data, hora e IP por 6 meses, por obrigação legal (Marco Civil da Internet) e segurança.
        </li>
        <li>
          <b>Marketing por WhatsApp:</b> só com consentimento separado e opcional, que pode ser retirado a qualquer momento.
        </li>
      </ul>

      <h2>3. Com quem compartilhamos</h2>
      <p>Apenas com fornecedores necessários para o serviço: hospedagem (Vercel), banco de dados e autenticação (Supabase, servidores no Brasil), envio de e-mail, motor de WhatsApp e o gateway de pagamento escolhido pelo lojista. Não vendemos dados pessoais.</p>

      <h2>4. Pagamentos</h2>
      <p>Dados de cartão não passam nem ficam guardados na {COMPANY.name}: são digitados no ambiente do gateway de pagamento. Guardamos só o resultado (pago, valor, identificador da cobrança).</p>

      <h2>5. Por quanto tempo</h2>
      <p>Enquanto a conta estiver ativa e por 90 dias após o cancelamento. Dados exigidos por lei (fiscais, registros de acesso) ficam pelo prazo legal.</p>

      <h2>6. Segurança</h2>
      <p>Conexão criptografada (HTTPS), senhas com hash, isolamento por loja no banco (cada loja só enxerga os próprios dados), e permissões por papel na equipe.</p>

      <h2>7. Seus direitos</h2>
      <p>Você pode pedir confirmação, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, e retirar consentimentos. Clientes de uma loja podem falar direto com a loja ou com a gente, e encaminhamos o pedido ao lojista.</p>

      <h2>8. Contato do encarregado (DPO)</h2>
      <p>
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. Respondemos em até 15 dias.
      </p>

      <h2>9. Mudanças</h2>
      <p>Mudanças relevantes são avisadas no painel e por e-mail. A versão aceita no cadastro fica registrada com data.</p>
    </LegalPage>
  );
}
