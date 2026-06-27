/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@talentos/auth", "@talentos/db"]
};

export default nextConfig;
