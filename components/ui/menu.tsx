'use client';

import * as React from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * A popover menu of actions (Radix dropdown menu: role="menu", arrow keys, Home and End, type-ahead,
 * Escape, focus returns to the trigger). For the ⋯ button on a row and for a button such as "Add testcases".
 * Give an icon-only trigger an `aria-label`. Compose with MenuItem, MenuLabel and MenuSeparator.
 */
function Menu({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  ...root
}: {
  /** The button that opens it; rendered as is (`asChild`). */
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
} & Pick<React.ComponentProps<typeof DropdownMenu.Root>, 'open' | 'onOpenChange'>) {
  return (
    <DropdownMenu.Root {...root}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} side={side} sideOffset={4} className="vd-popup">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  shortcut,
  children,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & {
  icon?: LucideIcon;
  /** A destructive action: red, and the action itself should still ask to confirm. */
  danger?: boolean;
  /** Hint such as "Alt+↑", shown on the right (the shortcut itself is not wired here). */
  shortcut?: string;
}) {
  return (
    <DropdownMenu.Item className={cn('vd-popup__item', danger && 'vd-popup__item--danger', className)} {...props}>
      {Icon && <Icon className="vd-icon size-4" strokeWidth={1.75} aria-hidden />}
      {children}
      {shortcut && <kbd className="vd-popup__kbd">{shortcut}</kbd>}
    </DropdownMenu.Item>
  );
}

function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn('vd-popup__label', className)} {...props} />;
}

function MenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('vd-popup__sep', className)} {...props} />;
}

export { Menu, MenuItem, MenuLabel, MenuSeparator };
