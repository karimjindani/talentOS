import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getOpsConfig, loadDotEnv } from "./config";
import { isAuthorized } from "./security";
import { runHealthChecks } from "./health";
import { createJob, getJob } from "./jobs";
import { appJs, renderIndex, stylesCss } from "./ui";
import type { OpsJobKind } from "@talentos/auth";

loadDotEnv();

const config = getOpsConfig();

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});

server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  console.log(`TalentOS Ops console listening at ${url}`);
  if (!config.token) {
    console.warn("OPS_TOKEN is not set. Run npm.cmd run ops:token before using protected actions.");
  }
});

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendText(res, 200, renderIndex(), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/assets/styles.css") {
    return sendText(res, 200, stylesCss, "text/css; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/assets/app.js") {
    return sendText(res, 200, appJs, "text/javascript; charset=utf-8");
  }

  if (url.pathname.startsWith("/api/ops/")) {
    if (!isAuthorized(req.headers.authorization, config.token)) {
      return sendJson(res, 401, { error: "Invalid or missing OPS_TOKEN." });
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

function sendText(res: ServerResponse, status: number, body: string, contentType: string) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}
