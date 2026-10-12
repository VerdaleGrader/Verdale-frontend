'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Anything inside a row that does its own thing when clicked.
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="menuitem"], [role="tab"], [data-row-ignore]';

/**
 * Should a click on a row run the row's operation? Only a click on empty space does:
 * not one on a link, button or form control, not one on the text itself (`RowText`, so
 * it can still be selected and copied), not one that ends a text selection, and not one
 * from a menu or dialog that a control in the row opened (React bubbles those through portals).
 */
export function isRowActivation(event: Pick<React.MouseEvent, 'target' | 'currentTarget' | 'button'>): boolean {
  if (event.button !== 0) return false;
  const row = event.currentTarget as Element;
  const target = event.target as Element | null;
  if (!target || !row.contains(target)) return false;
  const inner = target.closest(`${INTERACTIVE}, .vd-rowtext`);
  if (inner && row.contains(inner) && inner !== row) return false;
  return (window.getSelection()?.toString() ?? '') === '';
}

/**
 * A table row that runs the table's main operation when its empty space is clicked
 * (open the submission, edit the problem). Keyboard users do not get a second tab stop:
 * the row's main link stays the focusable target, and Enter on it does the same thing.
 * Wrap cell text in `RowText`. Never use it for a destructive operation.
 *
 * With neither `href` nor `onActivate`, or `disabled`, it is a plain row without the pointer cursor.
 */
export function ClickableRow({
  href,
  onActivate,
  disabled,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'tr'>, 'onClick'> & {
  /** Where the row leads. Ctrl, Cmd or Shift click opens it in a new tab. */
  href?: string;
  onActivate?: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const active = !disabled && (href !== undefined || onActivate !== undefined);
  return (
    <tr
      className={cn(active && 'vd-row-click', className)}
      onClick={
        active
          ? (event) => {
              if (!isRowActivation(event)) return;
              if (onActivate) onActivate();
              else if (href) {
                if (event.ctrlKey || event.metaKey || event.shiftKey) window.open(href, '_blank', 'noopener');
                else router.push(href);
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </tr>
  );
}

/** Text in a clickable row: clicking it selects instead of navigating. */
export function RowText({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('vd-rowtext', className)} {...props} />;
}
