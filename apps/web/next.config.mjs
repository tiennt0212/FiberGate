/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // antd v5 is CSS-in-JS; keep transpile hint for the icons/registry packages
  transpilePackages: ["@ant-design/icons", "@ant-design/nextjs-registry"],
};

export default nextConfig;
