'use client';

import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

interface RadioOption {
  value: string;
  label: string;
  /** A second line explaining the choice. */
  description?: string;
  disabled?: boolean;
}

/**
 * Replaces browser radio buttons (Radix: arrow keys move and select, one tab stop).
 * Pass `aria-label` or `aria-labelledby` to name the group.
 */
function RadioGroup({
  options,
  className,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroupPrimitive.Root>, 'children'> & { options: RadioOption[] }) {
  const prefix = React.useId();
  return (
    <RadioGroupPrimitive.Root className={cn('vd-radiogroup', className)} {...props}>
      {options.map((option) => {
        const id = `${prefix}-${option.value}`;
        return (
          <label key={option.value} htmlFor={id} className={cn('vd-check', option.disabled && 'is-disabled')}>
            <RadioGroupPrimitive.Item id={id} value={option.value} disabled={option.disabled} className="vd-radio__dot">
              <RadioGroupPrimitive.Indicator className="vd-radio__mark" />
            </RadioGroupPrimitive.Item>
            <span className="vd-check__text">
              <span className="vd-check__label">{option.label}</span>
              {option.description && <span className="vd-check__desc">{option.description}</span>}
            </span>
          </label>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

export { RadioGroup };
export type { RadioOption };
