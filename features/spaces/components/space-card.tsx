import Link from 'next/link';
import { Archive, Globe, Lock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, type Space } from '../types';

/** Badges that say, in words, what kind of Space this is. */
export function SpaceBadges({
  space,
}: {
  space: Pick<Space, 'visibility' | 'is_personal' | 'archived_at' | 'my_role'>;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {space.visibility === 'public' ? <Badge icon={Globe}>Public</Badge> : <Badge icon={Lock}>Private</Badge>}
      {space.is_personal && <Badge icon={User}>Personal</Badge>}
      {space.archived_at && (
        <Badge tone="warning" icon={Archive}>
          Archived
        </Badge>
      )}
      {space.my_role && <Badge tone="brand">{ROLE_LABELS[space.my_role]}</Badge>}
    </span>
  );
}

export function SpaceCard({ space }: { space: Space }) {
  return (
    <li>
      <Link
        href={`/spaces/${space.slug}`}
        className="border-border bg-surface hover:bg-surface-hover flex h-full flex-col gap-2 rounded-md border p-4 transition-colors duration-[120ms]"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-body-strong break-words">{space.name}</span>
          <span className="text-mono-label text-text-muted">{space.slug}</span>
        </span>
        {space.description && <p className="text-small text-text-muted line-clamp-2">{space.description}</p>}
        <SpaceBadges space={space} />
      </Link>
    </li>
  );
}

export function SpaceGrid({ spaces }: { spaces: Space[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {spaces.map((space) => (
        <SpaceCard key={space.id} space={space} />
      ))}
    </ul>
  );
}
