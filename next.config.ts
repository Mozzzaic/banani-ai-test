import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude @google/genai from Next.js bundling so it uses Node's native
  // fetch instead of Next's patched undici — fixes intermittent socket errors
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;
