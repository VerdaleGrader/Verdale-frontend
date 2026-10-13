'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldFrame } from './field';

interface DropdownOption {
  /** Must not be an empty string (Radix reserves it). */
  value: string;
  label: string;
  /** A second line in the list; the closed field shows the label only. */
  description?: string;
  /** Something small under the description, drawn but not read aloud (the option's label already says it). */
  extra?: React.ReactNode;
  /** Stays in the list, greyed out with a lock icon and no reason text. */
  locked?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /** Without a visible `label`, name the control for screen readers. */
  'aria-label'?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  name?: string;
  /** Native tooltip on the closed field, e.g. why it is disabled. */
  title?: string;
  className?: string;
}

/**
 * Replaces the browser select (Radix select: type-ahead, arrow keys, Escape, a list
 * that follows the theme). For short fixed lists such as role, visibility or language.
 */
function Dropdown({
  options,
  label,
  hint,
  error,
  placeholder,
  size = 'md',
  id,
  className,
  disabled,
  title,
  'aria-label': ariaLabel,
  ...root
}: DropdownProps) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} className={className}>
      <SelectPrimitive.Root disabled={disabled} {...root}>
        <SelectPrimitive.Trigger
          id={fieldId}
          title={title}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-message` : undefined}
          className={cn(
            'vd-input vd-dropdown__trigger',
            size === 'sm' && 'vd-dropdown__trigger--sm',
            error && 'is-invalid'
          )}
        >
          <span className="vd-dropdown__value">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="vd-icon size-4" strokeWidth={1.75} aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content position="popper" sideOffset={4} className="vd-popup vd-dropdown__list">
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.locked}
                  className="vd-popup__item vd-dropdown__item"
                >
                  <span className="vd-dropdown__text">
                    <SelectPrimitive.ItemText>
                      <span className="vd-dropdown__label">{option.label}</span>
                    </SelectPrimitive.ItemText>
                    {option.description && <span className="vd-dropdown__desc">{option.description}</span>}
                    {option.extra && (
                      <span className="vd-dropdown__extra" aria-hidden>
                        {option.extra}
                      </span>
                    )}
                  </span>
                  {option.locked ? (
                    <Lock className="vd-icon size-3.5" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <SelectPrimitive.ItemIndicator>
                      <Check className="vd-icon size-4" strokeWidth={1.75} aria-hidden />
                    </SelectPrimitive.ItemIndicator>
                  )}
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </FieldFrame>
  );
}

export { Dropdown };
export type { DropdownOption };
