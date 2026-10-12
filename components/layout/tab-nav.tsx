'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface TabNavItem {
  href: string;
  label: string;
  count?: number;
}

/** Tabs that are routes (Overview / Members / Settings): links, with aria-current on the active one. */
export function TabNav({ items, label }: { items: TabNavItem[]; label: string }) {
  const pathname = usePathname();
  // A page below a tab (a member's submissions, below Submissions) keeps that tab marked: the longest matching link wins.
  const current = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="vd-tabs overflow-x-auto">
      {items.map((item) => {
        const active = item === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn('vd-tab', active && 'is-active')}
          >
            {item.label}
            {item.count !== undefined && <span className="vd-tab__count">{item.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
