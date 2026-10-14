import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const coreUrl = process.env.CORE_API_URL || 'http://localhost:8080';

// The browser only ever calls relative URLs; /api/* is proxied to Core by
// app/api/[...path]/route.ts (a rewrite would follow Core's OAuth redirect
// on the server), so cookies stay first-party and there is no CORS.
const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: path.join(__dirname) },
  async rewrites() {
    return [
      { source: '/core/health', destination: `${coreUrl}/health` },
      { source: '/core/ready', destination: `${coreUrl}/ready` },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
