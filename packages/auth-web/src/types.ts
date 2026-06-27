import type { DefaultSession } from "next-auth";
import type { PlatformRole, TenantRole } from "@talentos/auth/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      roles: TenantRole[];
      orgRole: TenantRole | null;
      platformRole: PlatformRole | null;
      isSuperAdmin: boolean;
      keycloakSubjectId: string | null;
    } & DefaultSession["user"];
  }
}

/** Shape we store on the NextAuth JWT (cast-accessed to avoid jwt module augmentation). */
export type AppToken = {
  sub?: string;
  roles?: TenantRole[];
  orgRole?: TenantRole | null;
  platformRole?: PlatformRole | null;
  keycloakSubjectId?: string;
};
