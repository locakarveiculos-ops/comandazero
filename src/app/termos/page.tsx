import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COMPANY, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso da plataforma ComandaZero para lojistas e clientes finais.",
  alternates: { canonical: "/termos" },
};

export default function Page() {
  return (
    <LegalPage title="Termos de Uso" version={TERMS_VERSION}>
      <p>
        Estes Termos regulam o uso da plataforma {COMPANY.name} (cardápio digital, pedidos, PDV, KDS, mesas e integrações) por estabelecimentos (“lojistas”) e por quem faz pedidos nas lojas (“clientes”). Ao criar uma conta ou fazer
        um pedido, você concorda com estes Termos e com a <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>1. O que a plataforma faz</h2>
      <p>A {COMPANY.name} fornece software para o lojista vender: vitrine e cardápio, recebimento e acompanhamento de pedidos, controle de mesas e cozinha, e avisos por WhatsApp. A venda é feita pelo lojista, que é o responsável pelos produtos, preços, prazos, entrega, nota fiscal e atendimento ao cliente.</p>

      <h2>2. Conta do lojista</h2>
      <ul>
        <li>Os dados do cadastro precisam ser verdadeiros e atualizados.</li>
        <li>A senha é pessoal. Cada pessoa da equipe deve ter o próprio acesso, com o papel adequado (dono, gerente, caixa, garçom ou cozinha).</li>
        <li>O lojista responde pelo que a equipe faz no painel.</li>
      </ul>

      <h2>3. Planos, teste grátis e pagamento</h2>
      <ul>
        <li>Lojas novas têm período de teste gratuito, informado na tela de assinatura. Ao fim do teste, a loja continua no ar só com um plano ativo.</li>
        <li>A mensalidade é cobrada antecipadamente. Com pagamento em atraso por mais de 7 dias, o painel passa a funcionar só para consulta até a regularização; nenhum dado é apagado por atraso.</li>
        <li>A {COMPANY.name} não cobra comissão por pedido. Taxas de meios de pagamento (Pix, cartão) são do gateway escolhido pelo lojista.</li>
        <li>O cancelamento pode ser feito a qualquer momento e vale para o próximo ciclo.</li>
      </ul>

      <h2>4. Uso proibido</h2>
      <p>Não é permitido usar a plataforma para vender produtos ilegais, enviar mensagens em massa sem consentimento (spam), tentar acessar dados de outras lojas, ou sobrecarregar e burlar a segurança do sistema. Nesses casos a conta pode ser suspensa.</p>

      <h2>5. WhatsApp</h2>
      <p>O número de WhatsApp conectado é do lojista. Mensagens automáticas de pedido são enviadas só a clientes que fizeram pedido. Mensagens promocionais exigem consentimento do cliente. O lojista deve seguir as regras do WhatsApp, que pode limitar números por conta própria.</p>

      <h2>6. Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço no ar o tempo todo. Manutenções programadas são avisadas com antecedência. Falhas de serviços de terceiros (internet, WhatsApp, gateways de pagamento) estão fora do nosso controle.</p>

      <h2>7. Dados e saída da plataforma</h2>
      <p>Os dados da loja pertencem ao lojista. Ele pode pedir a exportação dos pedidos e clientes a qualquer momento. Após o cancelamento, os dados ficam guardados por 90 dias para eventual retorno e depois são excluídos, salvo o que a lei obrigar a manter.</p>

      <h2>8. Responsabilidade</h2>
      <p>A {COMPANY.name} responde por falhas do software que ela fornece, limitada ao valor pago nos últimos 12 meses. Não responde por perdas causadas por uso indevido da conta, por informações erradas cadastradas pelo lojista ou por falhas de serviços de terceiros.</p>

      <h2>9. Mudanças nestes Termos</h2>
      <p>Mudanças relevantes são avisadas no painel e por e-mail com pelo menos 15 dias de antecedência. Cada versão fica registrada com data; o aceite do lojista é guardado junto com a versão aceita.</p>

      <h2>10. Contato e foro</h2>
      <p>
        Dúvidas: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Fica eleito o foro do domicílio do consumidor, quando aplicável, ou o da sede da {COMPANY.name}.
      </p>
    </LegalPage>
  );
}
