import { beforeEach, describe, expect, it, vi } from "vitest";

// Envio de push: inscrição expirada (404/410) é apagada; erro de envio não derruba o pedido.
vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => send(...a) } }));

const deleted: string[][] = [];
let subs: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
const chain = (rows: unknown) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "update"]) q[m] = () => q;
  q.delete = () => ({ in: (_c: string, ids: string[]) => (deleted.push(ids), Promise.resolve({})) });
  q.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: rows }).then(r);
  return q;
};
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => ({ from: () => chain(subs) }) }));

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";
const { pushNewOrder } = await import("@/lib/server/push");
const order = { tenantId: "t", slug: "loja", number: 7, total: 18.9, mode: "Retirada" };

describe("pushNewOrder", () => {
  beforeEach(() => {
    send.mockReset();
    deleted.length = 0;
    subs = [
      { id: "a", endpoint: "https://fcm.googleapis.com/a", p256dh: "k", auth: "x" },
      { id: "b", endpoint: "https://fcm.googleapis.com/b", p256dh: "k", auth: "x" },
    ];
  });

  it("envia para cada aparelho da equipe com título e link do painel", async () => {
    send.mockResolvedValue({});
    expect(await pushNewOrder(order)).toBe(2);
    const payload = JSON.parse(send.mock.calls[0][1]);
    expect(payload.title).toBe("Novo pedido #7");
    expect(payload.url).toBe("/painel/loja/pedidos");
    expect(payload.body).toContain("R$");
  });

  it("apaga inscrição expirada (410) e mantém as outras", async () => {
    send.mockImplementation((s: { endpoint: string }) => (s.endpoint.endsWith("/a") ? Promise.reject(Object.assign(new Error("gone"), { statusCode: 410 })) : Promise.resolve({})));
    expect(await pushNewOrder(order)).toBe(1);
    expect(deleted).toEqual([["a"]]);
  });

  it("falha do serviço de push não lança erro", async () => {
    send.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    await expect(pushNewOrder(order)).resolves.toBe(0);
    expect(deleted).toEqual([]);
  });
});
