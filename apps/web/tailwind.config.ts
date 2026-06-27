import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0f172a",
          blue: "#2563eb",
          mist: "#eff6ff"
        }
      }
    }
  },
  plugins: []
};

export default config;
