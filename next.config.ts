import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Hide the Next.js dev indicator ("N" symbol & issues overlay badge) */
  devIndicators: false,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
