/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@travel/contracts"],
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
};

module.exports = nextConfig;
