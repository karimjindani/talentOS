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

// Slugs that must not become tenant subdomains: platform/infra hostnames, auth and object-storage
// labels, and the `demo` default catch-all tenant. Reserving these prevents routing confusion,
// cookie-scope bleed and subdomain-takeover concerns.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www", "admin", "api", "app", "apps", "auth", "sso", "login", "logout", "account", "accounts",
  "mail", "smtp", "ftp", "cdn", "assets", "static", "storage", "s3", "minio", "keycloak", "ops",
  "status", "health", "dashboard", "console", "internal", "system", "test", "demo", "root",
  "superadmin", "support", "help", "docs", "blog"
]);

// Tenant slugs become subdomains, so restrict to DNS-safe lowercase labels and reject reserved names.
export function isValidTenantSlug(slug: string): boolean {
  if (RESERVED_SLUGS.has(slug)) {
    return false;
  }
  return /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug);
}

function normalizeHost(hostHeader: string | null | undefined): string {
  return (hostHeader ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .trim();
}
