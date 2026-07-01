import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { getOpsConfig, loadDotEnv } from "./config";
import { runHealthChecks } from "./health";
import { createJob, getJob } from "./jobs";
import { appJs, renderIndex, stylesCss } from "./ui";
import type { OpsJobKind } from "@talentos/auth";
import { readOpsSettings, writeOpsSettings } from "./settings";
import {
  buildLoginRedirect,
  buildLogoutUrl,
  clearLoginCookie,
  clearSessionCookie,
  completeLogin,
  createLoginCookieValue,
  createSessionCookieValue,
  loginCookie,
  readLoginState,
  readSession,
  sessionCookie
} from "./auth";

loadDotEnv();

const config = getOpsConfig();

export function createOpsServer() {
  return createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
    }
  });
}

if (isMainModule()) {
  const server = createOpsServer();
  server.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    console.log(`TalentOS Ops console listening at ${url}`);
    console.log("Ops controls require a Keycloak session. OPS_TOKEN is no longer used.");
  });
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    const session = await readSession(config, req);
    if (!session) {
      return redirect(res, "/login");
    }
    return sendText(res, 200, renderIndex(), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/assets/styles.css") {
    return sendText(res, 200, stylesCss, "text/css; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/assets/app.js") {
    return sendText(res, 200, appJs, "text/javascript; charset=utf-8");
  }

  if (req.method === "GET" && url.pathname === "/login") {
    const settings = await readOpsSettings();
    const { url: loginUrl, loginState } = await buildLoginRedirect(config, settings.ops2faEnabled);
    res.writeHead(302, {
      Location: loginUrl.toString(),
      "Set-Cookie": loginCookie(config, await createLoginCookieValue(config, loginState))
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/auth/callback") {
    return handleAuthCallback(req, res, url);
  }

  if (req.method === "GET" && url.pathname === "/auth/error") {
    const reason = url.searchParams.get("reason") || "Your Keycloak role is not allowed to use Local Operations.";
    return sendText(res, 403, renderAuthError(reason), "text/html; charset=utf-8");
  }

  if ((req.method === "GET" || req.method === "POST") && url.pathname === "/logout") {
    const session = await readSession(config, req);
    const logoutUrl = buildLogoutUrl(config, session?.clientId ?? config.keycloak.normalClient.clientId);
    res.writeHead(302, {
      Location: logoutUrl.toString(),
      "Set-Cookie": [clearSessionCookie(config), clearLoginCookie(config)]
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith("/api/ops/")) {
    if (req.method === "GET" && url.pathname === "/api/ops/me") {
      const [session, settings] = await Promise.all([readSession(config, req), readOpsSettings()]);
      return sendJson(res, 200, {
        authenticated: Boolean(session),
        user: session
          ? {
              email: session.email,
              name: session.name,
              roles: session.roles,
              primaryRole: session.primaryRole,
              authenticatedAt: session.authenticatedAt
            }
          : null,
        ops2faEnabled: settings.ops2faEnabled,
        allowedRoles: config.allowedRoles
      });
    }

    const session = await readSession(config, req);
    if (!session) {
      return sendJson(res, 401, { error: "Sign in with Keycloak to use Local Operations." });
    }

    if (req.method === "POST" && url.pathname === "/api/ops/2fa") {
      const body = await readJson(req);
      const settings = { ops2faEnabled: body.enabled === true };
      await writeOpsSettings(settings);
      return sendJson(res, 200, {
        ...settings,
        message: "2FA setting will apply on next login."
      });
    }

    if (req.method === "POST" && url.pathname === "/api/ops/health") {
      return sendJson(res, 200, await runHealthChecks());
    }
    if (req.method === "POST" && url.pathname === "/api/ops/jobs") {
      const body = await readJson(req);
      const kind = body.kind as OpsJobKind;
      if (!["regression", "cleanup", "reset"].includes(kind)) {
        return sendJson(res, 400, { error: "Unknown job kind." });
      }
      return sendJson(res, 202, await createJob(kind));
    }
    const jobMatch = /^\/api\/ops\/jobs\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && jobMatch) {
      const job = await getJob(decodeURIComponent(jobMatch[1]));
      if (!job) return sendJson(res, 404, { error: "Job not found." });
      return sendJson(res, 200, job);
    }
  }

  return sendJson(res, 404, { error: "Not found." });
}

async function handleAuthCallback(req: IncomingMessage, res: ServerResponse, url: URL) {
  const loginState = await readLoginState(config, req);
  if (!loginState) {
    res.writeHead(302, {
      Location: "/login",
      "Set-Cookie": [clearSessionCookie(config), clearLoginCookie(config)]
    });
    res.end();
    return;
  }

  try {
    const session = await completeLogin(config, url.searchParams, loginState);
    res.writeHead(302, {
      Location: "/",
      "Set-Cookie": [
        sessionCookie(config, await createSessionCookieValue(config, session)),
        clearLoginCookie(config)
      ]
    });
    res.end();
  } catch (error) {
    const reason = encodeURIComponent(error instanceof Error ? error.message : "Keycloak login failed.");
    res.writeHead(302, {
      Location: `/auth/error?reason=${reason}`,
      "Set-Cookie": [clearSessionCookie(config), clearLoginCookie(config)]
    });
    res.end();
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  sendText(res, status, JSON.stringify(body, null, 2), "application/json; charset=utf-8");
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end();
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function renderAuthError(reason: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Local Operations Access Denied</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0c111a;
      color: #edf3fb;
    }
    body {
      display: grid;
      min-height: 100vh;
      margin: 0;
      place-items: center;
    }
    main {
      width: min(520px, calc(100vw - 32px));
      border: 1px solid #2b3c53;
      border-radius: 8px;
      background: #111927;
      padding: 24px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }
    p {
      color: #b5c2d4;
      line-height: 1.5;
    }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      border-radius: 8px;
      background: #2f8dcc;
      color: white;
      font-weight: 800;
      padding: 0 14px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main>
    <h1>Local Operations access denied</h1>
    <p>${escapeHtml(reason)}</p>
    <a href="/logout">Sign out</a>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char] ?? char);
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}
