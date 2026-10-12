'use client';

import Link from 'next/link';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';

/** Space settings: one link per Track to how far its people have got. */
export function ProgressionLinks() {
  const { space } = useSpace();
  const tracks = useApiQuery(() => catalogApi.tracks(space.slug, true), `progression-links-${space.slug}`);
  return (
    <section aria-labelledby="progression-links-heading" className="border-border flex flex-col gap-3 border-t pt-6">
      <h2 id="progression-links-heading" className="text-h2">
        Progression
      </h2>
      <p className="text-small text-text-muted">See how far members have got in each Track.</p>
      {tracks.status === 'loading' && <p className="text-small text-text-muted">Loading Tracks…</p>}
      {tracks.status === 'error' && (
        <p role="alert" className="text-small text-danger">
          Could not load the Tracks. {tracks.error.message}
        </p>
      )}
      {tracks.status === 'success' &&
        (tracks.data.length === 0 ? (
          <p className="text-small text-text-muted">This Space has no Tracks yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tracks.data.map((track) => (
              <li key={track.id}>
                <Link href={`/spaces/${space.slug}/tracks/${track.slug}/progress`} className="vd-link">
                  {track.name}
                </Link>
                {track.archived && <span className="text-small text-text-muted"> (archived)</span>}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
