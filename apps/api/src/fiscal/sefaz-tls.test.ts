import tls from "node:tls";
import { describe, expect, it } from "vitest";
import { ICP_BRASIL_V10_PEM } from "./icp-brasil-cas.js";
import { describeSefazTransportError, sefazTrustStore } from "./sefaz-tls.js";

describe("sefazTrustStore", () => {
  it("mantém as CAs da Mozilla e inclui a AC Raiz ICP-Brasil v10", () => {
    const store = sefazTrustStore();
    expect(store).toContain(ICP_BRASIL_V10_PEM);
    expect(store.length).toBe(tls.rootCertificates.length + 1);
    expect(ICP_BRASIL_V10_PEM).toMatch(/BEGIN CERTIFICATE/);
  });
});

describe("describeSefazTransportError", () => {
  it("explica falha de cadeia ICP-Brasil", () => {
    expect(
      describeSefazTransportError(
        new Error("unable to get local issuer certificate"),
      ),
    ).toMatch(/ICP-Brasil/);
  });
});
