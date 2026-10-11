'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { UserMenu } from '@/features/auth/components/user-menu';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  /** Only shown to signed-in users. */
  members?: boolean;
}

const NAV: NavItem[] = [
  { href: '/spaces', label: 'My Spaces', members: true },
  { href: '/explore', label: 'Explore' },
];

/** Brand, navigation and account. The nav scrolls sideways on narrow screens instead of wrapping. */
export function SiteHeader() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const items = NAV.filter((item) => !item.members || auth.status === 'authenticated');

  return (
    <header className="border-border bg-surface border-b">
      {/* Mobile: logo and account on the first row, navigation scrolls on its own row below. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2 md:px-8">
        <Link href="/" aria-label="Verdale home">
          <BrandLogo />
        </Link>
        <nav
          aria-label="Main"
          className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto"
        >
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'text-body-strong rounded-md px-3 py-1.5 whitespace-nowrap transition-colors duration-[120ms]',
                  active ? 'text-text bg-surface-hover' : 'text-text-muted hover:text-text hover:bg-surface-hover'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
