import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Le SDK Gandalf est publié en TypeScript brut (exports → src/*.ts).
  transpilePackages: ["@bleuh-co/gandalf-sdk-next"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
