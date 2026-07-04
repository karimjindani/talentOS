import { createTalentosAuth } from "@talentos/auth-web";

export const { handlers, auth, signIn, signOut } = createTalentosAuth({
  clientId: process.env.KEYCLOAK_CLIENT_ID ?? "talentos-applicant",
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "talentos-applicant-secret",
  issuer: process.env.KEYCLOAK_ISSUER ?? "http://keycloak.lvh.me:8080/realms/talentos"
});
