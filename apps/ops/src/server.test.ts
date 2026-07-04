import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createSessionCookieValue, sessionCookie, type OpsSession } from "./auth";
import { getOpsConfig } from "./config";
import { createOpsServer } from "./server";

let currentServer: Server | null = null;

afterEach(async () => {
  if (!currentServer) return;
  await new Promise<void>((resolve, reject) => {
    currentServer?.close((error) => {
      currentServer = null;
      if (error) reject(error);
      else resolve();
    });
  });
});

describe("ops server auth gate", () => {
  it("redirects unauthenticated root requests to Keycloak login", async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/`, { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("renders the operations page when a valid ops session exists", async () => {
    const baseUrl = await startServer();
    const config = getOpsConfig();
    const session: OpsSession = {
      email: "superadmin@talentos.local",
      name: "Platform Super Admin",
      roles: ["SUPER_ADMIN"],
      primaryRole: "SUPER_ADMIN",
      clientId: config.keycloak.normalClient.clientId,
      authenticatedAt: new Date().toISOString()
    };
    const cookie = sessionCookie(config, await createSessionCookieValue(config, session)).split(";")[0];

    const response = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("TalentOS Local Operations");
    expect(body).toContain("Regression Area");
    expect(body).toContain("Full Regression");
    expect(body).not.toContain('id="loginLink"');
  });
});

async function startServer() {
  currentServer = createOpsServer();
  await new Promise<void>((resolve) => {
    currentServer?.listen(0, "127.0.0.1", resolve);
  });
  const address = currentServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Ops test server did not bind to a TCP port.");
  }
  return `http://127.0.0.1:${address.port}`;
}
