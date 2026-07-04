import { local } from "./support";

type CookieRecord = { value: string; host: string; domain?: string };

class CookieJar {
  private cookies = new Map<string, CookieRecord>();

  header(url: string) {
    const { hostname } = new URL(url);
    const pairs: string[] = [];
    for (const [name, cookie] of this.cookies) {
      const domain = cookie.domain?.replace(/^\./, "");
      if (hostname === cookie.host || (domain && (hostname === domain || hostname.endsWith(`.${domain}`)))) {
        pairs.push(`${name}=${cookie.value}`);
      }
    }
    return pairs.join("; ");
  }

  store(url: string, headers: Headers) {
    const host = new URL(url).hostname;
    const values =
      typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : [];
    for (const raw of values) {
      const [pair, ...attrs] = raw.split(";").map((part) => part.trim());
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      const domain = attrs.find((attr) => attr.toLowerCase().startsWith("domain="))?.slice(7);
      this.cookies.set(name, { value, host, domain });
    }
  }
}

async function request(jar: CookieJar, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = jar.header(url);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...init, headers, redirect: "manual" });
  jar.store(url, response.headers);
  return response;
}

async function loginFlow(startUrl: string, username: string, password: string, finalUrlIncludes: string) {
  const jar = new CookieJar();
  let url = startUrl;
  for (let step = 0; step < 30; step++) {
    const response = await request(jar, url);
    const location = response.headers.get("location");
    if (location) {
      url = new URL(location, url).toString();
      continue;
    }

    const html = await response.text();
    const keycloakAction = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/)?.[1];
    if (keycloakAction) {
      const action = decodeHtml(keycloakAction);
      if (action.includes("host.docker.internal")) {
        throw new Error(`Keycloak login form used host.docker.internal: ${action}`);
      }
      const loginResponse = await request(jar, action, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password, credentialId: "" })
      });
      const next = loginResponse.headers.get("location");
      if (!next) throw new Error(`Keycloak did not redirect after credential submit for ${username}`);
      url = new URL(next, action).toString();
      continue;
    }

    const providerAction = html.match(/<form[^>]+action="([^"]*signin\/keycloak[^"]*)"[^>]*>([\s\S]*?)<\/form>/)?.[1];
    if (providerAction) {
      const csrf = html.match(/name="csrfToken"\s+value="([^"]+)"/)?.[1] ?? "";
      const signInResponse = await request(jar, new URL(decodeHtml(providerAction), url).toString(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrf, callbackUrl: startUrl, json: "true" })
      });
      const next = signInResponse.headers.get("location");
      if (!next) throw new Error(`Provider sign-in did not redirect for ${username}`);
      url = new URL(next, url).toString();
      continue;
    }

    if (html.includes("Sign in with Keycloak") && new URL(url).pathname === "/login") {
      const loginUrl = new URL(url);
      const callbackUrl = loginUrl.searchParams.get("callbackUrl") ?? startUrl;
      url = await startNextAuthProviderLogin(jar, `${loginUrl.origin}/api/auth`, callbackUrl);
      continue;
    }

    if (!url.includes(finalUrlIncludes)) {
      throw new Error(`Expected final URL to include ${finalUrlIncludes}, got ${url}`);
    }
    if (/access denied|unexpected "iss"|host\.docker\.internal/i.test(html)) {
      throw new Error(`Final page contains an auth/deployment error for ${username}`);
    }
    console.log(`OK ${username} -> ${url} HTTP ${response.status}`);
    return;
  }
  throw new Error(`Login flow exceeded redirect limit for ${username}`);
}

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", "\"");
}

async function startNextAuthProviderLogin(jar: CookieJar, authBaseUrl: string, callbackUrl: string) {
  const csrfResponse = await request(jar, `${authBaseUrl}/csrf`);
  if (!csrfResponse.ok) throw new Error(`Failed to fetch Auth.js CSRF token from ${authBaseUrl}`);
  const csrfPayload = await csrfResponse.json() as { csrfToken?: string };
  if (!csrfPayload.csrfToken) throw new Error(`Auth.js CSRF endpoint did not return csrfToken from ${authBaseUrl}`);

  const signInResponse = await request(jar, `${authBaseUrl}/signin/keycloak`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrfPayload.csrfToken, callbackUrl, json: "true" })
  });
  const next = signInResponse.headers.get("location");
  if (!next) throw new Error(`Auth.js provider sign-in did not redirect from ${authBaseUrl}`);
  return new URL(next, authBaseUrl).toString();
}

async function main() {
  await loginFlow(`${local.tenantAdminUrl}/`, "orgadmin@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3200");
  await loginFlow(`${local.tenantApplicantUrl}/application`, "applicant@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100");
  await loginFlow(`${local.tenantApplicantUrl}/dashboard`, "accepted@demo.talentos.local", "ChangeMe123!", "demo.lvh.me:3100");
  await loginFlow(`${local.opsUrl}/login`, "orgadmin@demo.talentos.local", "ChangeMe123!", "127.0.0.1:3300");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
