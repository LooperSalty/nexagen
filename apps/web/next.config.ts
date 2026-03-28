import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nexagen/shared", "@nexagen/db"],

  turbopack: {
    rules: {
      "*.vert": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.frag": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.(vert|frag|glsl)$/,
      type: "asset/source",
    });

    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
