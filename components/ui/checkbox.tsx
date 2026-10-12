'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, 'children'> & {
  /** Visible label. Without one, pass `aria-label`. */
  label?: React.ReactNode;
  /** A second line under the label. */
  description?: React.ReactNode;
};

/**
 * Replaces the browser checkbox (Radix: Space toggles, form value, mixed state via
 * `checked="indeterminate"`). For choices that wait for a Save or a submit; a setting
 * that applies at once is a Toggle.
 */
function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generated = React.useId();
  const boxId = id ?? generated;
  const box = (
    <CheckboxPrimitive.Root id={boxId} className={cn('vd-check__box', !label && className)} {...props}>
      <CheckboxPrimitive.Indicator className="vd-check__mark">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3" strokeWidth={2.5} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={2.5} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <label htmlFor={boxId} className={cn('vd-check', props.disabled && 'is-disabled', className)}>
      {box}
      <span className="vd-check__text">
        <span className="vd-check__label">{label}</span>
        {description && <span className="vd-check__desc">{description}</span>}
      </span>
    </label>
  );
}

export { Checkbox };
