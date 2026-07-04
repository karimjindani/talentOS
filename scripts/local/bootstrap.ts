import {
  repairKeycloakRealm,
  repairLocalEnv,
  run,
  startOpsConsoleIfNeeded,
  stopOpsConsoleIfRunning,
  waitForHttp,
  keycloakIssuer,
  local
} from "./support";

async function main() {
  console.log("Repairing local .env for TalentOS v0.12.2...");
  repairLocalEnv();
  stopOpsConsoleIfRunning();

  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install"]);
  await run("docker", ["compose", "config", "--quiet"]);
  await run("docker", ["compose", "up", "-d", "--build"]);

  await waitForHttp(`${keycloakIssuer}/.well-known/openid-configuration`, "Keycloak realm");
  await repairKeycloakRealm();

  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "db:generate"]);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "db:migrate"]);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "db:seed"]);
  await run(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "scripts/seed-dashboard.ts"]);

  await startOpsConsoleIfNeeded();
  await waitForHttp(local.opsUrl, "Ops Console");

  console.log("\nTalentOS local deployment is ready.");
  console.log(`Applicant: ${local.applicantUrl}`);
  console.log(`Applicant tenant: ${local.tenantApplicantUrl}`);
  console.log(`Admin: ${local.adminUrl}`);
  console.log(`Admin tenant: ${local.tenantAdminUrl}`);
  console.log(`Keycloak: ${local.keycloakBaseUrl}`);
  console.log(`MinIO: http://localhost:9001`);
  console.log(`Ops Console: ${local.opsUrl}`);
  console.log("\nDemo credentials: orgadmin@demo.talentos.local / ChangeMe123!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
