/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@talentos/auth", "@talentos/db", "@talentos/ui"]
};

export default nextConfig;
