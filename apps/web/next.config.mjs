/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // antd v5 is CSS-in-JS; keep transpile hint for the icons/registry packages
  transpilePackages: ["@ant-design/icons", "@ant-design/nextjs-registry"],
  // Required so docker/fibergate-core/Dockerfile can copy `.next/standalone` —
  // self-hosted merchants run `node server.js`, not a serverless function.
  // (Carried over from the docker-compose PR's next.config.js, which this file replaces.)
  output: "standalone",
};

export default nextConfig;
