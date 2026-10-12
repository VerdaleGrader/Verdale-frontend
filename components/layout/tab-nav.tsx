'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface TabNavItem {
  href: string;
  label: string;
  count?: number;
  /** Also active on the pages below this one (Manage and its Track and Collection editors). */
  matchPrefix?: boolean;
}

/** Tabs that are routes (Overview / Members / Settings): links, with aria-current on the active one. */
export function TabNav({ items, label }: { items: TabNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="vd-tabs overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href || (item.matchPrefix === true && pathname.startsWith(`${item.href}/`));
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
