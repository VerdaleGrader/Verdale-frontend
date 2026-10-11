import * as React from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldFrameProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldFrame({ id, label, hint, error, className, children }: FieldFrameProps) {
  return (
    <div className={cn('vd-field', className)}>
      {label && (
        <label htmlFor={id} className="vd-label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-message`} className="vd-hint vd-hint--error">
          <CircleAlert className="vd-icon size-4" strokeWidth={1.75} aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="vd-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  label?: string;
  hint?: string;
  /** Replaces the hint, marks the field invalid. */
  error?: string;
  mono?: boolean;
  multiline?: boolean;
  rows?: number;
  /** For `multiline`: the textarea element, e.g. to insert text at the cursor. */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
};

/** Labelled text input; `multiline` for a textarea, `mono` for code and limits. */
function TextField({
  label,
  hint,
  error,
  mono,
  multiline,
  rows = 4,
  className,
  id,
  textareaRef,
  ...props
}: TextFieldProps) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const shared = {
    id: fieldId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || hint ? `${fieldId}-message` : undefined,
    className: cn('vd-input', mono && 'vd-input--mono', multiline && 'vd-input--area', error && 'is-invalid'),
  };
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} className={className}>
      {multiline ? (
        <textarea ref={textareaRef} rows={rows} {...shared} {...(props as React.ComponentProps<'textarea'>)} />
      ) : (
        <input {...shared} {...props} />
      )}
    </FieldFrame>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

type SelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  label?: string;
  hint?: string;
  options: SelectOption[];
  size?: 'sm' | 'md';
};

/** Native select styled like TextField, for short fixed lists (role, visibility, language). */
function Select({ label, hint, options, size = 'md', className, id, ...props }: SelectProps) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} className={className}>
      <div className={cn('vd-select', size === 'sm' && 'vd-select--sm')}>
        <select
          id={fieldId}
          aria-describedby={hint ? `${fieldId}-message` : undefined}
          className="vd-input vd-select__control"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="vd-select__chev vd-icon size-4" strokeWidth={1.75} aria-hidden />
      </div>
    </FieldFrame>
  );
}

export { TextField, Select };
export type { SelectOption };
