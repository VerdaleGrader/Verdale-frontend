'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

type ToggleProps = Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, 'children'> & {
  /** Visible label. Without one, pass `aria-label`. */
  label?: React.ReactNode;
};

/**
 * An on/off setting (Radix switch: role="switch", Space toggles). It is for a value
 * that is either applied at once or, on a page with an UnsavedBar, held until Save:
 * in the second case say so next to it ("Takes effect when you save") and let the
 * UnsavedBar carry the pending state. A choice inside a form that is submitted is a Checkbox.
 */
function Toggle({ label, className, id, ...props }: ToggleProps) {
  const generated = React.useId();
  const switchId = id ?? generated;
  const control = (
    <SwitchPrimitive.Root id={switchId} className={cn('vd-toggle', !label && className)} {...props}>
      <SwitchPrimitive.Thumb className="vd-toggle__thumb" />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <label htmlFor={switchId} className={cn('vd-check vd-check--center', props.disabled && 'is-disabled', className)}>
      {control}
      <span className="vd-check__label">{label}</span>
    </label>
  );
}

export { Toggle };
