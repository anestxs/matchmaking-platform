import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    rules: {
      '*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            options: { dimensions: false },
          },
        ],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
