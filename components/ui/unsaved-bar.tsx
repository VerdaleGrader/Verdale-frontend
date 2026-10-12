import { Button } from './button';
import { cn } from '@/lib/utils';

/**
 * The bar that shows when a page holds changes the person has not saved yet, with Save and Discard.
 * `floating` sticks it to the bottom of the viewport. Pending values (a Toggle or a Checkbox waiting for Save,
 * a new order) are listed by the page; the bar says how many and carries the buttons.
 */
export function UnsavedBar({
  count,
  onSave,
  onDiscard,
  saving,
  floating,
  saveLabel = 'Save changes',
  discardLabel = 'Discard',
  error,
}: {
  count: number;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  floating?: boolean;
  saveLabel?: string;
  discardLabel?: string;
  /** Saving failed: says why in place of the count. The changes are still there. */
  error?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className={cn('vd-unsaved', floating && 'vd-unsaved--floating', error && 'vd-unsaved--error')}
    >
      <p className="vd-unsaved__text" role={error ? 'alert' : undefined} aria-live={error ? undefined : 'polite'}>
        {error ?? (count === 1 ? '1 unsaved change' : `${count} unsaved changes`)}
      </p>
      <div className="vd-unsaved__actions">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          {discardLabel}
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
