import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / Node-only backend packages the server bridge loads at runtime — never bundle them.
  serverExternalPackages: [
    "autobase",
    "hyperbee",
    "corestore",
    "hypercore",
    "hyperswarm",
    "hypercore-storage",
    "b4a",
    "@tetherto/wdk-wallet-evm",
    "@qvac/sdk",
    "ethers",
    "sharp",
  ],
};

export default nextConfig;
