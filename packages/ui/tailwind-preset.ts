import type { Config } from "tailwindcss";

/**
 * Shared TalentOS brand theme consumed by every app's Tailwind config so the
 * applicant and admin containers render with one source of truth.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "var(--brand-navy, #0f172a)",
          blue: "var(--brand-blue, #2563eb)",
          mist: "var(--brand-mist, #eff6ff)"
        }
      }
    }
  }
};

export default preset;
