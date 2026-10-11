import type { NextConfig } from 'next';
import path from 'path';

const coreUrl = process.env.CORE_API_URL || 'http://localhost:8080';

// The browser only ever calls relative URLs; Next.js proxies them to Core,
// so cookies stay first-party and there is no CORS.
const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: path.join(__dirname) },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${coreUrl}/api/:path*` },
      { source: '/core/health', destination: `${coreUrl}/health` },
      { source: '/core/ready', destination: `${coreUrl}/ready` },
    ];
  },
};

export default nextConfig;
