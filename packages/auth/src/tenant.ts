export type TenantResolution = {
  tenantSlug: string;
  source: "subdomain" | "default";
};

const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveTenantFromHost(
  hostHeader: string | null | undefined,
  baseDomain = process.env.APP_BASE_DOMAIN ?? "localhost",
  defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "demo"
): TenantResolution {
  const hostname = normalizeHost(hostHeader);

  if (!hostname) {
    return { tenantSlug: defaultTenantSlug, source: "default" };
  }

  if (hostname.endsWith(".localhost")) {
    return { tenantSlug: hostname.replace(".localhost", ""), source: "subdomain" };
  }

  if (LOCALHOSTS.has(hostname)) {
    return { tenantSlug: defaultTenantSlug, source: "default" };
  }

  const normalizedBaseDomain = normalizeHost(baseDomain);
  if (normalizedBaseDomain && hostname.endsWith(`.${normalizedBaseDomain}`)) {
    const subdomain = hostname.slice(0, -(normalizedBaseDomain.length + 1));
    return { tenantSlug: subdomain.split(".").at(-1) ?? defaultTenantSlug, source: "subdomain" };
  }

  return { tenantSlug: defaultTenantSlug, source: "default" };
}

// Tenant slugs become subdomains, so restrict to DNS-safe lowercase labels.
export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug);
}

function normalizeHost(hostHeader: string | null | undefined): string {
  return (hostHeader ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .trim();
}
