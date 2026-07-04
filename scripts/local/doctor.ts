import { keycloakIssuer, local, waitForHttp } from "./support";

const checks: Array<[string, string, number[]]> = [
  ["Applicant", local.applicantUrl, [200]],
  ["Admin", local.adminUrl, [307, 308]],
  ["Tenant applicant", local.tenantApplicantUrl, [200]],
  ["Tenant admin", local.tenantAdminUrl, [307, 308]],
  ["Keycloak realm", `${keycloakIssuer}/.well-known/openid-configuration`, [200]],
  ["MinIO health", `${local.minioEndpoint}/minio/health/live`, [200]],
  ["Ops Console", local.opsUrl, [200, 302]]
];

async function main() {
  let failed = false;
  for (const [name, url, ok] of checks) {
    try {
      const response = await waitForHttp(url, name, 5);
      const status = response.status;
      const result = ok.includes(status) ? "OK" : "FAIL";
      console.log(`${result} ${name}: HTTP ${status} ${url}`);
      if (result === "FAIL") failed = true;
    } catch (error) {
      failed = true;
      console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
