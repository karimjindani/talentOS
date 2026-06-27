import type { Config } from "tailwindcss";
import brandPreset from "@talentos/ui/tailwind-preset";

const config: Config = {
  presets: [brandPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  plugins: []
};

export default config;
