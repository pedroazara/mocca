import { describe, expect, it } from "vitest";
import { chaveDoIp, ipDaRequisicao } from "@/lib/rede/ip";

describe("IP do formulário de contato", () => {
  it("só confia nos cabeçalhos que a Vercel preenche", () => {
    const h = new Headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.7, 10.0.0.1" });
    expect(ipDaRequisicao(h)).toBe("198.51.100.7");
    expect(ipDaRequisicao(new Headers({ "x-real-ip": " 198.51.100.8 ", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.8");
    expect(ipDaRequisicao(new Headers({ "cf-connecting-ip": "203.0.113.9" }))).toBe("");
  });

  it("agrupa o IPv6 pelo /64 e deixa o IPv4 como está", () => {
    expect(chaveDoIp("198.51.100.7")).toBe("198.51.100.7");
    expect(chaveDoIp("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(chaveDoIp("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(chaveDoIp("2001:0db8:abcd:0012:ffff::1")).toBe("2001:db8:abcd:12::/64");
    expect(chaveDoIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(chaveDoIp("[2001:db8:abcd:12::9]")).toBe("2001:db8:abcd:12::/64");
    expect(chaveDoIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    // endereços diferentes do mesmo /64 caem na mesma chave
    expect(chaveDoIp("2001:db8:abcd:12::a")).toBe(chaveDoIp("2001:db8:abcd:12:ffff:ffff:ffff:fffe"));
  });
});
