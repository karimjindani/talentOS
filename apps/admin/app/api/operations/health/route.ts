import { NextResponse } from "next/server";
import { summarizeHealth, type OperationHealthCheck } from "@talentos/auth";
import { prisma } from "@talentos/db";
import { resolveTenantAccess } from "@/lib/tenant-guard";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 5000;

export async function GET() {
  // manageTenantUsers must be held *in the resolved tenant* (TenantMembership-backed). See D-051.
  const access = await resolveTenantAccess("manageTenantUsers");
  if (!access.ok) {
    const status =
      access.reason === "unauthenticated" ? 401 : access.reason === "unknown-tenant" ? 400 : 403;
    return NextResponse.json({ error: access.reason }, { status });
  }

  const checks: OperationHealthCheck[] = [
    await checkDatabase(),
    await checkHttp("Keycloak realm", discoveryUrl()),
    await checkHttp("MinIO API", `${process.env.S3_ENDPOINT ?? "http://host.docker.internal:9000"}/minio/health/live`),
    await checkWithFallbacks("Applicant Portal", applicantHealthUrls()),
    { name: "Admin Portal", status: "healthy", detail: "Admin API responded." }
  ];

  return NextResponse.json({
    status: summarizeHealth(checks),
    checkedAt: new Date().toISOString(),
    checks
  });
}

async function checkDatabase(): Promise<OperationHealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "PostgreSQL", status: "healthy", detail: "Database query succeeded." };
  } catch (error) {
    return { name: "PostgreSQL", status: "unhealthy", detail: errorDetail(error) };
  }
}

async function checkWithFallbacks(name: string, urls: string[]): Promise<OperationHealthCheck> {
  const details: string[] = [];
  for (const url of urls) {
    const result = await checkHttp(name, url);
    if (result.status === "healthy") return result;
    details.push(`${url}: ${result.detail}`);
  }
  return { name, status: "unhealthy", detail: details.join(" | ") };
}

async function checkHttp(name: string, url: string): Promise<OperationHealthCheck> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok || response.status === 307 || response.status === 308) {
      return { name, status: "healthy", detail: `${url} returned HTTP ${response.status}.` };
    }
    return { name, status: "unhealthy", detail: `${url} returned HTTP ${response.status}.` };
  } catch (error) {
    return { name, status: "unhealthy", detail: `${url}: ${errorDetail(error)}` };
  }
}

function discoveryUrl(): string {
  const issuer = process.env.KEYCLOAK_ISSUER ?? "http://host.docker.internal:8080/realms/talentos";
  return `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
}

function applicantHealthUrls(): string[] {
  const publicUrl = process.env.NEXT_PUBLIC_APPLICANT_URL ?? "http://localhost:3100";
  const urls = [publicUrl];
  try {
    const parsed = new URL(publicUrl);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = "host.docker.internal";
      urls.push(parsed.toString().replace(/\/$/, ""));
    }
  } catch {
    // Keep the original URL; checkHttp will report the error if it is invalid.
  }
  return [...new Set(urls)];
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
