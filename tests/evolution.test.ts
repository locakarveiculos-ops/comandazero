import { describe, expect, it } from "vitest";
import { evolution, evolutionInstanceName, evolutionView } from "@/lib/integrations/whatsapp/evolution";

// Formatos reais da Evolution v2.3: connect, connectionState e create.
describe("Evolution: QR e estado", () => {
  it("connect devolve QR em base64 com prefixo data:", () => {
    const s = evolutionView({ pairingCode: null, code: "2@abc", base64: "data:image/png;base64,iVBORw0", count: 1 });
    expect(s).toEqual({ state: "connecting", qr: "data:image/png;base64,iVBORw0", pairingCode: null, phone: null });
  });
  it("QR sem prefixo ganha data:image/png", () => expect(evolutionView({ qrcode: { base64: "iVBORw0" } }).qr).toBe("data:image/png;base64,iVBORw0"));
  it("conectado com número", () => expect(evolutionView({ instance: { instanceName: "cz-loja", state: "open", ownerJid: "5519999990000@s.whatsapp.net" } })).toMatchObject({ state: "open", phone: "5519999990000", qr: null }));
  it("fechado vira desconectado", () => expect(evolutionView({ instance: { state: "close" } }).state).toBe("disconnected"));
  it("instância própria do ComandaZero e sem webhook por padrão", () => {
    expect(evolutionInstanceName("burger-station")).toBe("cz-burger-station");
    expect(evolution.createInstance("cz-x").body).not.toHaveProperty("webhook");
  });
});
