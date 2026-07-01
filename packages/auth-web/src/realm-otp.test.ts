import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The realm import lives at the repo root: packages/auth-web/src -> ../../../keycloak/...
const realmPath = fileURLToPath(new URL("../../../keycloak/import/talentos-realm.json", import.meta.url));

describe("keycloak realm OTP policy", () => {
  it("defines a non-zero TOTP period so first-login enrollment does not divide by zero", () => {
    const realm = JSON.parse(readFileSync(realmPath, "utf8")) as {
      otpPolicyType?: string;
      otpPolicyPeriod?: number;
      otpPolicyDigits?: number;
    };
    expect(realm.otpPolicyType).toBe("totp");
    // A missing/zero period caused TimeBasedOTP.getCurrentInterval to divide by zero (v0.10.1 fix).
    expect(typeof realm.otpPolicyPeriod).toBe("number");
    expect(realm.otpPolicyPeriod).toBeGreaterThan(0);
    expect(realm.otpPolicyDigits).toBeGreaterThan(0);
  });
});
