import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';
import { LegalGate } from '@/features/legal/components/legal-gate';
import { Providers } from '@/components/providers';
import { SITE_DESCRIPTION, SITE_URL, THEME_COLOR } from '@/lib/site-metadata';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { THEME_INIT_SCRIPT } from '@/components/layout/theme-toggle';
import './globals.css';

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans' });
// Problem statements may be written in Thai.
const plexThai = IBM_Plex_Sans_Thai({ subsets: ['thai'], weight: ['400', '500', '600'], variable: '--font-plex-thai' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

// Neutral defaults for every route; the home page adds its own Open Graph tags (app/page.tsx).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Verdale',
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = { themeColor: THEME_COLOR };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexThai.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply a stored theme before first paint; a static string, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="bg-surface text-text focus:border-border-strong sr-only rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:border"
        >
          Skip to content
        </a>
        <Providers>
          <LegalGate />
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
