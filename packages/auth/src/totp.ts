import { authenticator } from "otplib";

export type TotpEnrollment = {
  secret: string;
  otpauthUrl: string;
};

export function createTotpEnrollment(email: string, issuer = "TalentOS"): TotpEnrollment {
  const secret = authenticator.generateSecret();
  return {
    secret,
    otpauthUrl: authenticator.keyuri(email, issuer, secret)
  };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.check(token, secret);
}
