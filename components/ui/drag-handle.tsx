import * as React from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The grip a person drags a row by (use it with SortableList, which wires dnd-kit's listeners to it).
 * Never the only way to reorder: SortableList also offers Move up and Move down. A view-only role
 * does not get a handle at all.
 */
const DragHandle = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'> & { label: string }>(
  function DragHandle({ label, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={`Drag to reorder ${label}`}
        className={cn('vd-drag', className)}
        {...props}
      >
        <GripVertical className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    );
  }
);

export { DragHandle };
