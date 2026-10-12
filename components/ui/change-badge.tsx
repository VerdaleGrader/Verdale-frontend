import {
  ArrowRightLeft,
  Eye,
  EyeOff,
  FilePlus2,
  FileX2,
  Equal,
  Undo2,
  Replace,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from './badge';

type ChangeKind =
  | 'new'
  | 'moved'
  | 'now-visible'
  | 'now-hidden'
  | 'input-replaced'
  | 'output-changed'
  | 'new-output'
  | 'same'
  | 'kept'
  | 'removed';

type Tone = 'neutral' | 'brand' | 'info' | 'warning' | 'danger';

const CHANGES: Record<ChangeKind, { text: (from?: number) => string; tone: Tone; icon: LucideIcon }> = {
  new: { text: () => 'New', tone: 'brand', icon: FilePlus2 },
  moved: { text: (from) => (from === undefined ? 'Moved' : `Moved from ${from}`), tone: 'info', icon: ArrowRightLeft },
  'now-visible': { text: () => 'Now visible', tone: 'info', icon: Eye },
  'now-hidden': { text: () => 'Now hidden', tone: 'info', icon: EyeOff },
  'input-replaced': { text: () => 'Input replaced', tone: 'warning', icon: Replace },
  'output-changed': { text: () => 'Output changed', tone: 'warning', icon: Replace },
  'new-output': { text: () => 'New output', tone: 'brand', icon: FilePlus2 },
  same: { text: () => 'Same as before', tone: 'neutral', icon: Equal },
  kept: { text: () => 'Kept', tone: 'neutral', icon: Check },
  removed: { text: () => 'Will be removed', tone: 'danger', icon: FileX2 },
};

/**
 * What will change in a row when the person saves: the fixed set of messages and tones for the Changes column.
 * Pass `onUndo` with `removed` to add the Undo button ("Will be removed" + Undo).
 */
export function ChangeBadge({
  kind,
  from,
  onUndo,
}: {
  kind: ChangeKind;
  /** For `moved`: the position the row came from. */
  from?: number;
  onUndo?: () => void;
}) {
  const change = CHANGES[kind];
  return (
    <span className="vd-inline">
      <Badge tone={change.tone} icon={change.icon}>
        {change.text(from)}
      </Badge>
      {kind === 'removed' && onUndo && (
        <button type="button" className="vd-linkbtn" onClick={onUndo}>
          <Undo2 className="vd-icon size-3.5" strokeWidth={1.75} aria-hidden />
          Undo
        </button>
      )}
    </span>
  );
}

export type { ChangeKind };
