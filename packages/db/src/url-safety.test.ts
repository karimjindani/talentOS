import { describe, expect, it, vi } from "vitest";
import {
  buildSubmissionEvidenceLinks,
  checkPublicEvidenceUrl,
  createPinnedLookup,
  isBlockedIpAddress,
  MAX_DEPLOYMENT_URLS,
  normalizeDeploymentUrls,
  parseDeploymentUrls,
  parseEvidenceUrl,
  type PublicUrlCheckDependencies
} from "./url-safety";

describe("evidence URL syntax", () => {
  it("requires a GitHub owner/repository URL and a Loom share/watch URL", () => {
    expect(parseEvidenceUrl("https://github.com/acme/project", "repository")).toBe("https://github.com/acme/project");
    expect(parseEvidenceUrl("https://www.loom.com/share/demo-id", "loom")).toBe("https://www.loom.com/share/demo-id");
    expect(() => parseEvidenceUrl("https://github.com/acme/project/issues", "repository")).toThrow("owner/repository");
    expect(() => parseEvidenceUrl("https://www.loom.com/pricing", "loom")).toThrow("share or watch");
  });

  it("rejects credentials, non-HTTP schemes and obvious internal destinations", () => {
    expect(() => parseEvidenceUrl("https://user:pass@example.com", "deployment")).toThrow("valid public");
    expect(() => parseEvidenceUrl("file:///etc/passwd", "deployment")).toThrow("valid public");
    expect(() => parseEvidenceUrl("http://localhost:3000", "deployment")).toThrow("valid public");
  });
});

describe("deployment URL lists", () => {
  it("keeps existing single-URL submissions compatible", () => {
    expect(parseDeploymentUrls("https://app.example.com")).toEqual(["https://app.example.com/"]);
    expect(normalizeDeploymentUrls("https://app.example.com")).toBe("https://app.example.com/");
  });

  it("splits semicolons, trims spaces and removes blank segments", () => {
    expect(parseDeploymentUrls(" https://app.example.com ; ; https://api.example.com ")).toEqual([
      "https://app.example.com/",
      "https://api.example.com/"
    ]);
  });

  it("removes exact normalized duplicates while preserving order", () => {
    expect(
      parseDeploymentUrls("https://api.example.com;https://app.example.com;https://api.example.com/")
    ).toEqual(["https://api.example.com/", "https://app.example.com/"]);
  });

  it("identifies the malformed URL that blocks the list", () => {
    expect(() => parseDeploymentUrls("https://app.example.com;not-a-url")).toThrow("not-a-url");
  });

  it("limits deployment URL input to a reasonable maximum", () => {
    const urls = Array.from({ length: MAX_DEPLOYMENT_URLS + 1 }, (_, index) => `https://app${index}.example.com`);
    expect(() => parseDeploymentUrls(urls.join(";"))).toThrow(`${MAX_DEPLOYMENT_URLS}`);
  });

  it("builds a separate labeled link for each deployment URL", () => {
    const links = buildSubmissionEvidenceLinks({
      repositoryUrl: "https://github.com/acme/project",
      deploymentUrl: "https://app.example.com/;https://api.example.com/",
      loomUrl: "https://www.loom.com/share/demo"
    });
    expect(links.filter((link) => link.label.startsWith("Deployed application"))).toEqual([
      { label: "Deployed application 1", href: "https://app.example.com/" },
      { label: "Deployed application 2", href: "https://api.example.com/" }
    ]);
  });
});

describe("SSRF address protections", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.8",
    "172.16.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "192.0.2.10",
    "198.51.100.10",
    "203.0.113.10",
    "::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "::ffff:127.0.0.1"
  ])("blocks %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it("allows representative public IPv4 and IPv6 addresses", () => {
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
    expect(isBlockedIpAddress("192.30.255.113")).toBe(false);
    expect(isBlockedIpAddress("198.50.100.10")).toBe(false);
    expect(isBlockedIpAddress("203.1.113.10")).toBe(false);
    expect(isBlockedIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});

describe("pinned DNS lookup", () => {
  it("supports both Node's single-address and all-address callback modes", () => {
    const lookup = createPinnedLookup({ address: "93.184.216.34", family: 4 });
    const single = vi.fn();
    const all = vi.fn();

    lookup("example.com", { all: false }, single);
    lookup("example.com", { all: true }, all);

    expect(single).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });
});

describe("bounded public reachability checks", () => {
  it("pins a validated public DNS address and accepts a successful HEAD response", async () => {
    const dependencies = publicMocks([{ statusCode: 200, location: null }]);
    const result = await checkPublicEvidenceUrl("https://example.com/app", "deployment", dependencies);
    expect(result.reachable).toBe(true);
    expect(dependencies.resolveHostname).toHaveBeenCalledWith("example.com");
    expect(dependencies.requestOnce).toHaveBeenCalledWith(
      expect.any(URL),
      "HEAD",
      { address: "93.184.216.34", family: 4 },
      4000
    );
  });

  it("uses a bounded GET fallback when HEAD is rejected", async () => {
    const dependencies = publicMocks([
      { statusCode: 405, location: null },
      { statusCode: 200, location: null }
    ]);
    const result = await checkPublicEvidenceUrl("https://example.com/app", "deployment", dependencies);
    expect(result.reachable).toBe(true);
    expect(dependencies.requestOnce).toHaveBeenNthCalledWith(2, expect.any(URL), "GET", expect.any(Object), 4000);
  });

  it("rejects DNS resolving to private space and redirects into private space", async () => {
    const privateDns = publicMocks([]);
    privateDns.resolveHostname.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    expect((await checkPublicEvidenceUrl("https://example.com", "deployment", privateDns)).reachable).toBe(false);
    expect(privateDns.requestOnce).not.toHaveBeenCalled();

    const redirected = publicMocks([{ statusCode: 302, location: "http://127.0.0.1/admin" }]);
    const result = await checkPublicEvidenceUrl("https://example.com", "deployment", redirected);
    expect(result.reachable).toBe(false);
    expect(redirected.requestOnce).toHaveBeenCalledTimes(1);
  });

  it("does not treat valid GitHub syntax as proof that a repository is public", async () => {
    const result = await checkPublicEvidenceUrl(
      "https://github.com/acme/private-or-missing",
      "repository",
      publicMocks([{ statusCode: 404, location: null }])
    );
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("not publicly reachable");
  });

  it("returns a clear timeout result without exposing the internal error", async () => {
    const dependencies = publicMocks([]);
    dependencies.requestOnce.mockRejectedValue(new Error("PUBLIC_URL_CHECK_TIMEOUT"));
    const result = await checkPublicEvidenceUrl("https://example.com", "loom", dependencies);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("timed out");
    expect(result.error).not.toContain("PUBLIC_URL_CHECK_TIMEOUT");
  });
});

function publicMocks(responses: Array<{ statusCode: number; location: string | null }>) {
  const resolveHostname = vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  const requestOnce = vi.fn();
  for (const response of responses) requestOnce.mockResolvedValueOnce(response);
  return { resolveHostname, requestOnce } satisfies PublicUrlCheckDependencies & {
    resolveHostname: ReturnType<typeof vi.fn>;
    requestOnce: ReturnType<typeof vi.fn>;
  };
}
