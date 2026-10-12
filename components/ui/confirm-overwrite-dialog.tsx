'use client';

import { useState } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Dialog } from './dialog';

interface OverwriteItem {
  id: string | number;
  /** "Testcase 3" */
  label: string;
  /** "3.out · 12 KB · visible to solvers" */
  detail?: string;
}

/**
 * Asks before an upload or Generate replaces files that already exist: lists what would be overwritten,
 * each item ticked, and the person unticks any to keep. The confirm button counts what will be replaced
 * and is disabled when nothing is ticked.
 */
export function ConfirmOverwriteDialog(props: ConfirmOverwriteDialogProps) {
  // Mounted only while open, so every opening starts with everything ticked.
  return props.open ? <OverwriteContent {...props} /> : null;
}

type ConfirmOverwriteDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  items: OverwriteItem[];
  confirmLabel?: string;
  onConfirm: (ids: Array<OverwriteItem['id']>) => void;
  onClose: () => void;
};

function OverwriteContent({
  open,
  title,
  description,
  items,
  confirmLabel = 'Overwrite',
  onConfirm,
  onClose,
}: ConfirmOverwriteDialogProps) {
  const [kept, setKept] = useState<Set<OverwriteItem['id']>>(new Set());
  const ticked = items.filter((item) => !kept.has(item.id));
  const toggle = (id: OverwriteItem['id'], checked: boolean) =>
    setKept((current) => {
      const next = new Set(current);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={ticked.length === 0}
            onClick={() => onConfirm(ticked.map((item) => item.id))}
          >
            {confirmLabel} {ticked.length} {ticked.length === 1 ? 'file' : 'files'}
          </Button>
        </>
      }
    >
      <ul className="vd-overwrite" aria-label="Files that will be replaced">
        {items.map((item) => (
          <li key={item.id}>
            <Checkbox
              label={item.label}
              description={item.detail}
              checked={!kept.has(item.id)}
              onCheckedChange={(next) => toggle(item.id, next === true)}
            />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export type { OverwriteItem };
