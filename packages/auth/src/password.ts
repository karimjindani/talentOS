import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  assertStrongEnoughPassword(password);
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function assertStrongEnoughPassword(password: string): void {
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters long.");
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Password must include uppercase, lowercase and numeric characters.");
  }
}
