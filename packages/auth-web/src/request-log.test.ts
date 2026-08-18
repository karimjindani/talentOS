import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRequestLog, isRequestLogEnabled, logRequest, shouldLogRequest } from "./request-log";

// Guards the middleware request log (v0.20.2, D-102). v0.20.1 logged every request in every
// environment; these tests pin the two properties that fixed it — opt-in only, and asset paths
// filtered — so neither can regress back into a production firehose.
describe("isRequestLogEnabled", () => {
  it('is on only for the exact opt-in value "1"', () => {
    expect(isRequestLogEnabled({ REQUEST_LOG: "1" })).toBe(true);
  });

  it("is off when unset, so a deployed environment is quiet by default", () => {
    expect(isRequestLogEnabled({})).toBe(false);
    expect(isRequestLogEnabled({ REQUEST_LOG: undefined })).toBe(false);
  });

  it("is off for other truthy-looking values rather than guessing intent", () => {
    for (const value of ["0", "true", "yes", "on", ""]) {
      expect(isRequestLogEnabled({ REQUEST_LOG: value })).toBe(false);
    }
  });

  it("ignores NODE_ENV — the local Docker stack runs NODE_ENV=production and must still log", () => {
    expect(isRequestLogEnabled({ NODE_ENV: "production", REQUEST_LOG: "1" })).toBe(true);
    expect(isRequestLogEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("shouldLogRequest", () => {
  it("logs real navigations and API calls", () => {
    for (const path of ["/", "/dashboard", "/dashboard/journal", "/api/auth/session", "/missions/abc"]) {
      expect(shouldLogRequest(path)).toBe(true);
    }
  });

  it("filters Next data and HMR payloads the middleware matcher still lets through", () => {
    expect(shouldLogRequest("/_next/data/build-id/dashboard.json")).toBe(false);
    expect(shouldLogRequest("/_next/webpack-hmr")).toBe(false);
  });

  it("filters static files served from public/", () => {
    for (const path of ["/logo.svg", "/styles.css", "/app.js", "/bundle.js.map", "/robots.txt", "/photo.PNG"]) {
      expect(shouldLogRequest(path)).toBe(false);
    }
  });

  it("does not mistake a path segment containing a dot for a file extension", () => {
    expect(shouldLogRequest("/missions/v1.2-release")).toBe(true);
  });
});

describe("formatRequestLog", () => {
  it("renders one line in the repo's [prefix] console convention", () => {
    expect(
      formatRequestLog({
        app: "admin",
        method: "GET",
        pathname: "/missions",
        tenantSlug: "demo",
        authenticated: true,
        timestamp: new Date("2026-08-13T10:20:30.000Z")
      })
    ).toBe("[admin] 2026-08-13T10:20:30.000Z GET /missions tenant=demo auth=true");
  });
});

describe("logRequest", () => {
  afterEach(() => vi.restoreAllMocks());

  const fields = {
    app: "applicant",
    method: "GET",
    pathname: "/dashboard",
    tenantSlug: "demo",
    authenticated: false,
    timestamp: new Date("2026-08-13T10:20:30.000Z")
  };

  it("writes when enabled", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logRequest(fields, { REQUEST_LOG: "1" });
    expect(spy).toHaveBeenCalledWith("[applicant] 2026-08-13T10:20:30.000Z GET /dashboard tenant=demo auth=false");
  });

  it("writes nothing when the flag is absent", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logRequest(fields, {});
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes nothing for a filtered path even when enabled", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logRequest({ ...fields, pathname: "/logo.svg" }, { REQUEST_LOG: "1" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("swallows a console failure so observability cannot break the auth middleware", () => {
    vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("EPIPE: stdout closed");
    });
    expect(() => logRequest(fields, { REQUEST_LOG: "1" })).not.toThrow();
  });
});
