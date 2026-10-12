import { formatTime } from '@/lib/format';

/**
 * The reading surface of a problem: Space, title, limits, author, then the
 * rendered statement in `prose` at the 72ch measure. Samples go in SampleIO
 * after it; hidden tests are never part of the statement.
 */
export function ProblemStatement({
  title,
  space,
  limits,
  author,
  children,
}: {
  title: string;
  space?: string;
  limits?: { timeMs?: number; memoryMb?: number };
  author?: string;
  /** Rendered Markdown (maths typeset with KaTeX in M3). */
  children?: React.ReactNode;
}) {
  return (
    <article className="vd-problem">
      {space && <p className="vd-problem__space">{space}</p>}
      <h1 className="vd-problem__title">{title}</h1>
      <dl className="vd-problem__meta">
        {limits?.timeMs !== undefined && (
          <div>
            <dt>Time limit</dt>
            <dd>{formatTime(limits.timeMs)}</dd>
          </div>
        )}
        {limits?.memoryMb !== undefined && (
          <div>
            <dt>Memory limit</dt>
            <dd>{limits.memoryMb} MB</dd>
          </div>
        )}
        {author && (
          <div>
            <dt>Author</dt>
            <dd>{author}</dd>
          </div>
        )}
      </dl>
      <div className="vd-prose">{children}</div>
    </article>
  );
}
