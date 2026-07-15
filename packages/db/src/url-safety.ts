import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

export type EvidenceUrlKind = "repository" | "deployment" | "loom";
export type HttpMethod = "HEAD" | "GET";

export type ResolvedAddress = {
  address: string;
  family: number;
};

export type BoundedHttpResponse = {
  statusCode: number;
  location: string | null;
};

export type PublicUrlCheckDependencies = {
  resolveHostname?: (hostname: string) => Promise<ResolvedAddress[]>;
  requestOnce?: (
    url: URL,
    method: HttpMethod,
    address: ResolvedAddress,
    timeoutMs: number
  ) => Promise<BoundedHttpResponse>;
  timeoutMs?: number;
  maxRedirects?: number;
};

export type PublicUrlCheckResult = {
  reachable: boolean;
  finalUrl: string;
  statusCode: number | null;
  error: string | null;
};

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_REDIRECTS = 3;
const HEAD_FALLBACK_STATUSES = new Set([400, 403, 405, 501]);

const KIND_LABEL: Record<EvidenceUrlKind, string> = {
  repository: "GitHub repository",
  deployment: "deployed application",
  loom: "Loom walkthrough"
};

/** Validate and normalize an optional evidence URL before it is stored in a draft. */
export function parseEvidenceUrl(raw: string, kind: EvidenceUrlKind): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
    normalizePublicHostname(url);
  } catch {
    throw new Error(`Enter a valid public ${kind} URL (including https://).`);
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (kind === "repository") {
    if (host !== "github.com" && host !== "www.github.com") {
      throw new Error("The repository URL must be on github.com.");
    }
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length !== 2 || !pathSegments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
      throw new Error("Enter a GitHub repository URL in the form https://github.com/owner/repository.");
    }
  }

  if (kind === "loom") {
    if (host !== "loom.com" && host !== "www.loom.com") {
      throw new Error("The Loom URL must be on loom.com.");
    }
    if (!/^\/(share|watch)\/[^/]+\/?$/.test(url.pathname)) {
      throw new Error("Enter a Loom share or watch URL.");
    }
  }

  url.hash = "";
  return url.toString();
}

/**
 * Check one public evidence URL without allowing the request to reach private infrastructure.
 * DNS is resolved and validated first, then the HTTP connection is pinned to that checked address.
 * Every redirect starts the same validation process again.
 */
export async function checkPublicEvidenceUrl(
  value: string,
  kind: EvidenceUrlKind,
  dependencies: PublicUrlCheckDependencies = {}
): Promise<PublicUrlCheckResult> {
  const resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname;
  const requestOnce = dependencies.requestOnce ?? defaultRequestOnce;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = dependencies.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let current = new URL(value);

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const hostname = normalizePublicHostname(current);
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await resolveHostname(hostname);

      if (addresses.length === 0) {
        return failure(current, `${KIND_LABEL[kind]} hostname could not be resolved.`);
      }
      if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
        return failure(current, `${KIND_LABEL[kind]} must use a public internet address.`);
      }

      const pinnedAddress = addresses[0];
      let response = await requestOnce(current, "HEAD", pinnedAddress, timeoutMs);
      if (HEAD_FALLBACK_STATUSES.has(response.statusCode)) {
        response = await requestOnce(current, "GET", pinnedAddress, timeoutMs);
      }

      if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
        if (redirectCount === maxRedirects) {
          return failure(current, `${KIND_LABEL[kind]} redirected too many times.`, response.statusCode);
        }
        current = new URL(response.location, current);
        continue;
      }

      if (response.statusCode >= 200 && response.statusCode < 400) {
        return {
          reachable: true,
          finalUrl: current.toString(),
          statusCode: response.statusCode,
          error: null
        };
      }

      if (response.statusCode === 429) {
        return failure(
          current,
          `${KIND_LABEL[kind]} could not be verified because the public service rate-limited the check. Try again shortly.`,
          response.statusCode
        );
      }

      return failure(
        current,
        `${KIND_LABEL[kind]} is not publicly reachable (HTTP ${response.statusCode}).`,
        response.statusCode
      );
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "PUBLIC_URL_CHECK_TIMEOUT";
    return failure(
      current,
      timedOut
        ? `${KIND_LABEL[kind]} did not respond before the public-access check timed out.`
        : `${KIND_LABEL[kind]} could not be reached publicly.`
    );
  }

  return failure(current, `${KIND_LABEL[kind]} could not be reached publicly.`);
}

export function normalizePublicHostname(url: URL): string {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public HTTP and HTTPS URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname) {
    throw new Error("A public hostname is required.");
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "metadata.google.internal" ||
    (!hostname.includes(".") && isIP(hostname) === 0)
  ) {
    throw new Error("Internal-only hostnames are not allowed.");
  }
  if (isIP(hostname) > 0 && isBlockedIpAddress(hostname)) {
    throw new Error("Private or reserved network addresses are not allowed.");
  }
  return hostname;
}

export function isBlockedIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) {
    return isBlockedIpv4(normalized);
  }
  if (family === 6) {
    return isBlockedIpv6(normalized);
  }
  return true;
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const [a, b, c] = octets;
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  if (value == null || value === 0n || value === 1n) {
    return true;
  }

  const top8 = Number(value >> 120n);
  const top16 = Number(value >> 112n);
  const top32 = Number(value >> 96n);
  if (
    top8 === 0xfc ||
    top8 === 0xfd ||
    top8 === 0xff ||
    (top16 >= 0xfe80 && top16 <= 0xfebf) ||
    (top16 >= 0xfec0 && top16 <= 0xfeff) ||
    top32 === 0x20010db8
  ) {
    return true;
  }

  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  if (value >> 32n === 0xffffn) {
    const ipv4 = Number(value & 0xffffffffn);
    return isBlockedIpv4(
      `${(ipv4 >>> 24) & 255}.${(ipv4 >>> 16) & 255}.${(ipv4 >>> 8) & 255}.${ipv4 & 255}`
    );
  }

  return false;
}

function ipv6ToBigInt(address: string): bigint | null {
  const embeddedIpv4 = address.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  let normalized = address;
  if (embeddedIpv4) {
    const octets = embeddedIpv4.split(".").map(Number);
    if (octets.length !== 4 || octets.some((value) => value < 0 || value > 255)) {
      return null;
    }
    const first = ((octets[0] << 8) | octets[1]).toString(16);
    const second = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = address.slice(0, -embeddedIpv4.length) + `${first}:${second}`;
  }

  const [leftRaw, rightRaw, extra] = normalized.split("::");
  if (extra !== undefined) {
    return null;
  }
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (!normalized.includes("::") && missing !== 0)) {
    return null;
  }
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
    return null;
  }
  return parts.reduce((result, part) => (result << 16n) + BigInt(`0x${part}`), 0n);
}

async function defaultResolveHostname(hostname: string): Promise<ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function defaultRequestOnce(
  url: URL,
  method: HttpMethod,
  address: ResolvedAddress,
  timeoutMs: number
): Promise<BoundedHttpResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, address.address, address.family);
    };
    const request = transport(
      url,
      {
        method,
        lookup: pinnedLookup,
        headers: {
          "user-agent": "TalentOS-Public-Evidence-Check/1.0",
          accept: "text/html,application/xhtml+xml",
          ...(method === "GET" ? { range: "bytes=0-1023" } : {})
        }
      },
      (response) => {
        const result = {
          statusCode: response.statusCode ?? 0,
          location: typeof response.headers.location === "string" ? response.headers.location : null
        };
        response.destroy();
        resolve(result);
      }
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("PUBLIC_URL_CHECK_TIMEOUT"));
    });
    request.on("error", reject);
    request.end();
  });
}

function failure(url: URL, error: string, statusCode: number | null = null): PublicUrlCheckResult {
  return { reachable: false, finalUrl: url.toString(), statusCode, error };
}
