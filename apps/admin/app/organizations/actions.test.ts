import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  can: vi.fn(),
  getUserByEmail: vi.fn(),
  createOrganization: vi.fn(),
  provisionOrgAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@talentos/auth", () => ({
  can: mocks.can,
  isValidTenantSlug: (slug: string) => /^[a-z0-9-]+$/.test(slug) && slug !== "demo"
}));

vi.mock("@talentos/db", () => ({
  createOrganization: mocks.createOrganization,
  getUserByEmail: mocks.getUserByEmail,
  slugify: (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}));

vi.mock("@/lib/keycloak-admin", () => ({
  provisionOrgAdmin: mocks.provisionOrgAdmin
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createOrganizationAction, type OrgActionState } from "./actions";

describe("createOrganizationAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.can.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { email: "superadmin@talentos.local", platformRole: "SUPER_ADMIN" } });
    mocks.getUserByEmail.mockResolvedValue({ id: "superadmin-1" });
  });

  function buildFormData(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("name", "Acme Corp");
    fd.set("slug", "acme");
    fd.set("primaryColor", "#2563eb");
    fd.set("secondaryColor", "#0f172a");
    fd.set("adminEmail", "admin@acme.com");
    fd.set("adminName", "Acme Admin");
    for (const [k, v] of Object.entries(overrides)) {
      fd.set(k, v);
    }
    return fd;
  }

  it("creates an org and provisions the org admin in Keycloak", async () => {
    mocks.createOrganization.mockResolvedValue({});
    mocks.provisionOrgAdmin.mockResolvedValue({
      created: true,
      tempPassword: "TempPass123!"
    });

    const result = await createOrganizationAction(null, buildFormData()) as OrgActionState;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tempPassword).toBe("TempPass123!");
    }
    expect(mocks.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Corp", slug: "acme", adminEmail: "admin@acme.com" })
    );
    expect(mocks.provisionOrgAdmin).toHaveBeenCalledWith({ email: "admin@acme.com", name: "Acme Admin" });
  });

  it("reports when the admin already had a Keycloak account", async () => {
    mocks.createOrganization.mockResolvedValue({});
    mocks.provisionOrgAdmin.mockResolvedValue({ created: false, tempPassword: null });

    const result = await createOrganizationAction(null, buildFormData()) as OrgActionState;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tempPassword).toBeNull();
      expect(result.message).toContain("already had");
    }
  });

  it("returns an error when the name is missing", async () => {
    const result = await createOrganizationAction(null, buildFormData({ name: "" })) as OrgActionState;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("name");
    }
  });

  it("returns an error for an invalid primary color", async () => {
    const result = await createOrganizationAction(null, buildFormData({ primaryColor: "blue" })) as OrgActionState;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("hex");
    }
  });

  it("returns an error for an invalid admin email", async () => {
    const result = await createOrganizationAction(null, buildFormData({ adminEmail: "not-an-email" })) as OrgActionState;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("email");
    }
  });

  it("returns an error when createOrganization throws (duplicate slug)", async () => {
    mocks.createOrganization.mockRejectedValue(new Error('A tenant with slug "acme" already exists.'));

    const result = await createOrganizationAction(null, buildFormData()) as OrgActionState;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
  });

  it("still reports success when Keycloak provisioning fails (retryable)", async () => {
    mocks.createOrganization.mockResolvedValue({});
    mocks.provisionOrgAdmin.mockRejectedValue(new Error("Keycloak unreachable"));

    const result = await createOrganizationAction(null, buildFormData()) as OrgActionState;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("Keycloak");
      expect(result.tempPassword).toBeNull();
    }
  });
});
