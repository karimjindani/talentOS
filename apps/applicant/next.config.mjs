/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@talentos/auth", "@talentos/auth-web", "@talentos/db", "@talentos/ui"]
};

export default nextConfig;
