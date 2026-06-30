/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@talentos/auth", "@talentos/auth-web", "@talentos/db", "@talentos/storage", "@talentos/ui"]
};

export default nextConfig;
