'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Buttons, primary or danger last. */
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

/**
 * A modal for a focused decision or short form (Radix: focus trap, Escape,
 * portal). Destructive confirms should name the thing and the consequence,
 * and use a danger button that repeats the verb.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <div className="vd-dialog-layer">
          <DialogPrimitive.Overlay className="vd-scrim" />
          <DialogPrimitive.Content className={cn('vd-dialog', size === 'lg' && 'vd-dialog--lg')}>
            <div className="vd-dialog__head">
              <DialogPrimitive.Title className="vd-dialog__title">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close className="vd-iconbtn" aria-label="Close">
                <X className="size-4" strokeWidth={1.75} aria-hidden />
              </DialogPrimitive.Close>
            </div>
            {description ? (
              <DialogPrimitive.Description className="vd-dialog__desc">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="vd-sr">{title}</DialogPrimitive.Description>
            )}
            {children && <div className="vd-dialog__body">{children}</div>}
            {footer && <div className="vd-dialog__foot">{footer}</div>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
