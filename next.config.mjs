import { xrayPlugin } from "@stinsky/xray/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  // pdf-parse relies on its Node-specific @napi-rs/canvas dependency to
  // provide DOMMatrix. Bundling it into a Turbopack server chunk strips that
  // runtime boundary and causes knowledge routes to fail during module load.
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [],
  },
  turbopack: {
    root: process.cwd(),
    rules: xrayPlugin({ bundler: "turbopack", editor: "code" }),
  },
};

export default nextConfig;
