const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function safeHex(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback;
}

type BrandTenant = { primaryColor?: string | null; secondaryColor?: string | null } | null;

export function brandStyleBlock(tenant: BrandTenant): string {
  const blue = safeHex(tenant?.primaryColor, "#2563eb");
  const navy = safeHex(tenant?.secondaryColor, "#0f172a");
  const mist = blue === "#2563eb" ? "#eff6ff" : "#f8fafc";
  return `:root{--brand-blue:${blue};--brand-navy:${navy};--brand-mist:${mist}}`;
}
