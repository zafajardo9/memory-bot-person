import { xrayPlugin } from "@stinsky/xray/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [],
  },
  turbopack: {
    rules: xrayPlugin({ bundler: "turbopack", editor: "code" }),
  },
};

export default nextConfig;
