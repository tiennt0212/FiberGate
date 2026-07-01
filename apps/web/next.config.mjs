/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enables instrumentation.ts, where the in-process invoice poller boots (BR-POL-001).
  experimental: {
    instrumentationHook: true,
  },
  // antd + @ant-design/nextjs-registry transpile cleanly under App Router.
  transpilePackages: ["antd", "@ant-design/icons", "@ant-design/nextjs-registry"],
  output: "standalone",
};

export default nextConfig;
