import Link from 'next/link';

interface Crumb {
  label: React.ReactNode;
  /** Every crumb but the last links somewhere. */
  href?: string;
}

/** Where this page sits: a link for every level, the last one is the current page (`aria-current`). */
export function Breadcrumb({ items, label = 'Breadcrumb' }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label} className="vd-crumbs">
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={index}>
              {last || !item.href ? (
                <span aria-current={last ? 'page' : undefined} className={last ? 'vd-crumbs__current' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="vd-link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
