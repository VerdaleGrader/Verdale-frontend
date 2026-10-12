import { problemsApi } from '@/features/problems/api/problems.api';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { kilobytesToMegabytes } from '@/features/problems/types';
import { formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';

/**
 * What the headers say about a problem besides its submissions: title, version, limits and how many testcases it has.
 * Best effort: a header line that cannot be loaded is simply left out, the list below does not depend on it.
 */
export function useProblemFacts(slug: string, problemSlug: string) {
  const { auth } = useAuth();
  const target = { slug, problemSlug };
  const problem = useApiQuery(
    () => problemsApi.get(target).catch(() => null),
    `problem-facts-${slug}-${problemSlug}-${auth.status}`
  );
  const tests = useApiQuery(
    () => problemsApi.tests(target).catch(() => null),
    `problem-tests-${slug}-${problemSlug}-${auth.status}`
  );
  return {
    problem: problem.status === 'success' ? problem.data : null,
    tests: tests.status === 'success' && tests.data ? tests.data.summary : null,
  };
}

/** "two-sum · Version 3 · 1 s · 256 MB · 20 testcases (2 sample, 18 hidden)". */
export function factsLine(
  problemSlug: string,
  facts: ReturnType<typeof useProblemFacts>,
  { split = false }: { split?: boolean } = {}
): Array<string | { mono: string }> {
  const parts: Array<string | { mono: string }> = [{ mono: problemSlug }];
  const { problem, tests } = facts;
  if (problem) {
    parts.push(
      `Version ${problem.version_number}`,
      formatTime(problem.time_limit_ms),
      `${kilobytesToMegabytes(problem.memory_limit_kb)} MB`
    );
  }
  if (tests) {
    parts.push(
      split
        ? `${tests.count} testcases (${tests.sample_count} sample, ${tests.count - tests.sample_count} hidden)`
        : `${tests.count} ${tests.count === 1 ? 'testcase' : 'testcases'}`
    );
  }
  return parts;
}
