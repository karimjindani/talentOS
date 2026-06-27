import { createTalentosAuth } from "@talentos/auth-web";

export const { handlers, auth, signIn, signOut } = createTalentosAuth({
  clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-admin",
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "talentos-admin-secret",
  issuer: process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/talentos"
});
