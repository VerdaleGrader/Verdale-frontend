'use client';

import Link from 'next/link';
import { Lock, Settings2 } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { catalogApi } from '../api/catalog.api';
import { trackPath, type TrackSummary } from '../types';
import { ProgressMeter } from './progress-meter';

const SHOW = ['active', 'all'] as const;

// Search and "show archived" live in the URL (?q=…&show=all); defaults are left out.
const QUERY = { q: param.text(), show: param.oneOf(SHOW, 'active') };

/**
 * The Tracks of a Space that the signed-in person (or visitor) can open, in the order the Space's authors set.
 * Core decides which ones those are; staff see all of them, and can also list archived ones.
 */
export function TracksView() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const staff = abilities.canAuthorProblems;
  const { values, set } = useUrlQuery(QUERY);
  const [input, setInput] = useDebouncedText(values.q, (text) => set({ q: text }));
  const includeArchived = staff && values.show === 'all';
  const tracks = useApiQuery(
    () => catalogApi.tracks(space.slug, includeArchived),
    `tracks-${space.slug}-${auth.status}-${includeArchived}`
  );

  const query = values.q.toLowerCase();
  const shown =
    tracks.status === 'success'
      ? tracks.data.filter(
          (track) =>
            !query || track.name.toLowerCase().includes(query) || track.description.toLowerCase().includes(query)
        )
      : [];

  return (
    <section aria-labelledby="tracks-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="tracks-heading" className="text-h2">
          Tracks
        </h2>
        {abilities.canEditProblems && (
          <Link href={`/spaces/${space.slug}/tracks/edit`} className={buttonVariants({ variant: 'secondary' })}>
            <Settings2 aria-hidden />
            Manage Tracks
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          type="search"
          label="Search Tracks"
          placeholder="Name or description"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full max-w-xs"
        />
        {staff && (
          <Dropdown
            label="Show"
            value={values.show}
            options={[
              { value: 'active', label: 'Active Tracks' },
              { value: 'all', label: 'Including archived' },
            ]}
            onValueChange={(next) => set({ show: next as (typeof SHOW)[number] })}
            className="w-52"
          />
        )}
      </div>

      {tracks.status === 'loading' && <Loading label="Loading Tracks" />}
      {tracks.status === 'error' && <ErrorState error={tracks.error} onRetry={tracks.reload} />}
      {tracks.status === 'success' &&
        (shown.length === 0 ? (
          <EmptyState
            title={values.q ? `No Tracks match “${values.q}”` : 'No Tracks yet'}
            description={
              values.q
                ? 'Try a shorter or different word.'
                : abilities.canEditProblems
                  ? 'A Track is an ordered path of Collections of problems. Create one to give people something to work through.'
                  : 'Tracks that you can open will appear here.'
            }
            action={
              !values.q && abilities.canEditProblems ? (
                <Link href={`/spaces/${space.slug}/tracks/edit`} className={buttonVariants({ variant: 'secondary' })}>
                  Manage Tracks
                </Link>
              ) : auth.status === 'anonymous' && !values.q ? (
                <Link
                  href={`/login?next=${encodeURIComponent(`/spaces/${space.slug}/tracks`)}`}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  Log in to see your Tracks
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((track) => (
              <TrackCard key={track.id} spaceSlug={space.slug} track={track} staff={staff} />
            ))}
          </ul>
        ))}
    </section>
  );
}

function TrackCard({ spaceSlug, track, staff }: { spaceSlug: string; track: TrackSummary; staff: boolean }) {
  return (
    <li className="border-border bg-surface relative flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-body-strong break-words">
          {/* The whole card is the link target, so empty space opens the Track too. */}
          <Link href={trackPath(spaceSlug, track.slug)} className="vd-link after:absolute after:inset-0">
            {track.name}
          </Link>
        </h3>
        <p className="text-mono-label text-text-muted">{track.slug}</p>
      </div>
      {track.description && <p className="text-small text-text-muted line-clamp-2">{track.description}</p>}
      <p className="text-small text-text-muted">
        {track.collection_count} {track.collection_count === 1 ? 'Collection' : 'Collections'} · {track.problem_count}{' '}
        {track.problem_count === 1 ? 'problem' : 'problems'}
      </p>
      <ProgressMeter progress={track.progress} label={`Progress in ${track.name}`} />
      {(staff || track.is_member) && (
        <span className="flex flex-wrap gap-1.5">
          {track.privacy === 'members' && (
            <Badge icon={Lock} tone="info">
              Members only
            </Badge>
          )}
          {track.archived && <Badge tone="warning">Archived</Badge>}
          {track.is_member && <Badge tone="brand">You were added</Badge>}
        </span>
      )}
    </li>
  );
}
