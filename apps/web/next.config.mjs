/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@ant-design/icons", "@ant-design/nextjs-registry"],
};

export default nextConfig;
