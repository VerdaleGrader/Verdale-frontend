import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Verdale buttons: one primary action per view, borders not shadows,
// 120 ms transitions, 45% opacity when disabled.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-body-strong whitespace-nowrap transition-colors duration-[120ms] ease-out outline-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed',
        secondary: 'border border-border-strong bg-surface text-text hover:bg-surface-hover',
        ghost: 'text-text hover:bg-surface-hover',
        destructive: 'bg-danger text-[var(--on-danger)] hover:opacity-90',
        link: 'text-brand-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-[var(--control-sm)] px-3',
        md: 'h-[var(--control-md)] px-3',
        lg: 'h-[var(--control-lg)] px-4',
        icon: 'size-[var(--control-md)]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'button';
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
