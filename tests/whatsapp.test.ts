import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { numberedCard, parseIncoming, sender } from "@/lib/integrations/whatsapp/card";
import { respond, welcome } from "@/lib/integrations/whatsapp/bot";
import { verifySignature, slugFromInstance, instanceFor } from "@/lib/integrations/whatsapp/whaileys";
import { seal, unseal } from "@/lib/server/seal";
import { CATEGORIES, PRODUCTS, TENANTS } from "@/lib/seed";

const SECRET = "segredo-de-teste";
const sign = (raw: string, ts: string, secret = SECRET) => createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");

describe("assinatura do webhook Whaileys", () => {
  const raw = JSON.stringify({ instanceKey: "cpw-cafe-e-flor", key: { id: "ABC123", remoteJid: "5519999990000@s.whatsapp.net" } });
  const now = 1_763_100_000_000;
  const ts = String(now);

  it("aceita assinatura válida", () => expect(verifySignature(raw, ts, sign(raw, ts), SECRET, now)).toBe(true));
  it("recusa corpo adulterado", () => expect(verifySignature(raw.replace("ABC", "XYZ"), ts, sign(raw, ts), SECRET, now)).toBe(false));
  it("recusa segredo errado", () => expect(verifySignature(raw, ts, sign(raw, ts, "outro"), SECRET, now)).toBe(false));
  it("recusa timestamp de 6 minutos", () => expect(verifySignature(raw, ts, sign(raw, ts), SECRET, now + 6 * 60_000)).toBe(false));
  it("recusa cabeçalhos ausentes ou malformados", () => {
    expect(verifySignature(raw, null, sign(raw, ts), SECRET, now)).toBe(false);
    expect(verifySignature(raw, ts, "zz", SECRET, now)).toBe(false);
    expect(verifySignature(raw, ts, sign(raw, ts), "", now)).toBe(false);
  });
});

describe("mensagens recebidas", () => {
  it("clique de botão vira o id", () => expect(parseIncoming({ buttonsResponseMessage: { selectedButtonId: "ok:o1" } })).toEqual({ kind: "action", id: "ok:o1" }));
  it("clique de lista vira o id", () =>
    expect(parseIncoming({ listResponseMessage: { singleSelectReply: { selectedRowId: "cat:c_cafes" } } })).toEqual({ kind: "action", id: "cat:c_cafes" }));
  it("native flow vira o id", () =>
    expect(parseIncoming({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"menu:pedir"}' } } })).toEqual({ kind: "action", id: "menu:pedir" }));
  it("'1' e '2' digitados casam com a última lista", () => {
    expect(parseIncoming({ conversation: "2" }, ["menu:cardapio", "menu:pedir"])).toEqual({ kind: "action", id: "menu:pedir" });
    expect(parseIncoming({ conversation: "9" }, ["menu:cardapio"])).toEqual({ kind: "text", text: "9" });
  });
  it("localização é reconhecida", () => expect(parseIncoming({ locationMessage: { degreesLatitude: -23.09, degreesLongitude: -47.21 } }).kind).toBe("location"));
  it("mensagem vazia é ignorada", () => expect(parseIncoming({}).kind).toBe("ignored"));
});

describe("remetente", () => {
  it("ignora fromMe e grupos", () => {
    expect(sender({ remoteJid: "5519999990000@s.whatsapp.net", fromMe: true })).toEqual({ ignore: "fromMe" });
    expect(sender({ remoteJid: "123@g.us" })).toEqual({ ignore: "chat" });
  });
  it("usa senderPn quando o chat vem só com LID", () => {
    expect(sender({ remoteJid: "999@lid", senderPn: "5519995868521@s.whatsapp.net" })).toEqual({ phone: "5519995868521", replyTo: "999@lid" });
    expect(sender({ remoteJid: "999@lid" })).toEqual({ ignore: "sem número", lidOnly: true });
  });
});

describe("cards e robô", () => {
  const tenant = TENANTS[0];
  const cat = { tenant, categories: CATEGORIES.filter((c) => c.tenantId === tenant.id), products: PRODUCTS.filter((p) => p.tenantId === tenant.id) };

  it("respeita limites do motor (3 botões de 20, 10 linhas de 24) e numera no texto", () => {
    const b = numberedCard("x", Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, title: "Um título comprido demais aqui" })));
    expect(b.card.buttons).toHaveLength(3);
    expect(b.card.buttons!.every((x) => x.title.length <= 20)).toBe(true);
    expect(b.card.text).toContain("1. Um título");
    const l = numberedCard("x", Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, title: "Linha com título bem grande" })), true);
    expect(l.card.sections![0].rows).toHaveLength(10);
    expect(l.card.sections![0].rows.every((r) => r.title.length <= 24)).toBe(true);
  });

  it("'oi' abre o menu e categoria lista produtos com link do app", () => {
    const menu = welcome(cat, "https://app.test");
    expect(menu.options).toContain("menu:cardapio");
    const r = respond(cat, { kind: "action", id: "cat:c_cafes" }, "https://app.test")!;
    expect(r.card.sections![0].rows.map((x) => x.id)).toContain("prod:p_cappuccino");
    const p = respond(cat, { kind: "action", id: "prod:p_cappuccino" }, "https://app.test")!;
    expect(p.card.text).toContain("https://app.test/loja/cafe-e-flor?item=p_cappuccino");
  });

  it("atendente marca handoff", () => expect(respond(cat, { kind: "action", id: "menu:atendente" }, "https://x")!.handoff).toBe(true));
});

describe("selo do canal", () => {
  beforeEach(() => vi.stubEnv("CHANNEL_SEAL_KEY", "k".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("abre o que selou e recusa adulterado", () => {
    const blob = seal({ v: 1, instance: "cpw-cafe-e-flor", token: "t", secret: "s", bot: true });
    expect(unseal<{ instance: string }>(blob)?.instance).toBe("cpw-cafe-e-flor");
    const bad = blob.slice(0, -2) + (blob.endsWith("A") ? "BB" : "AA");
    expect(unseal(bad)).toBeNull();
  });

  it("instância ↔ slug", () => {
    expect(instanceFor("cafe-e-flor")).toBe("cpw-cafe-e-flor");
    expect(slugFromInstance("cpw-cafe-e-flor")).toBe("cafe-e-flor");
    expect(slugFromInstance("ppia-xyz")).toBeNull();
  });
});
