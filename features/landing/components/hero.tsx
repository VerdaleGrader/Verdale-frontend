'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { CodeEditorFrame } from '@/components/grader/code-editor-frame';
import { TestProgress } from '@/components/grader/test-progress';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import type { Verdict } from '@/components/grader/verdict';
import { LandingActions } from './landing-actions';

const TOTAL = 12;
const LANGUAGES = [{ value: 'cpp', label: 'C++' }];

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True when the visitor asked for less motion. The server render counts as reduced, so it shows the finished run. */
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true
  );
}

/** Sample judging run: tests finish one by one, wait a moment on Accepted, then start again. Still when motion is reduced. */
function useJudgingStep() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setTick((value) => (value + 1) % (TOTAL + 10)), 420);
    return () => clearInterval(timer);
  }, [reduced]);
  return reduced ? TOTAL : Math.min(tick, TOTAL);
}

/** The sample data is made up: a problem name and figures that only illustrate the page. */
function SolvePreview() {
  const t = useTranslations('Landing.hero');
  const step = useJudgingStep();
  const done = step >= TOTAL;
  const results: Verdict[] = Array.from({ length: TOTAL }, (_, index) =>
    index < step ? 'AC' : index === step ? 'RUNNING' : 'QUEUED'
  );
  const verdict: Verdict = done ? 'AC' : 'RUNNING';
  return (
    <div
      role="img"
      aria-label={t('previewLabel')}
      className="bg-surface border-border overflow-hidden rounded-lg border"
    >
      {/* Presentation only: nothing inside takes focus or is read out separately. */}
      <div inert>
        <div className="border-border flex flex-wrap items-end justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-caption text-text-muted">Algorithms 101 / Week 2 · Hashing</span>
            <span className="text-h3">Pairs with sum K</span>
          </div>
          <span className="text-mono-label text-text-muted">1 s · 256 MB</span>
        </div>
        <div className="p-3">
          <CodeEditorFrame languages={LANGUAGES} language="cpp" submitDisabled>
            <pre className="vd-code overflow-x-auto whitespace-pre">
              <span className="ln">
                <span className="tk-ty">#include</span> <span className="tk-str">&lt;bits/stdc++.h&gt;</span>
              </span>
              <span className="ln">
                <span className="tk-kw">using namespace</span> std;
              </span>
              <span className="ln"> </span>
              <span className="ln">
                <span className="tk-ty">int</span> <span className="tk-fn">main</span>() {'{'}
              </span>
              <span className="ln">
                {'  '}
                <span className="tk-ty">int</span> n; <span className="tk-ty">long long</span> k; cin &gt;&gt; n
                &gt;&gt; k;
              </span>
              <span className="ln">
                {'  '}unordered_map&lt;<span className="tk-ty">long long</span>, <span className="tk-ty">int</span>
                &gt; seen;
              </span>
              <span className="ln">
                {'  '}
                <span className="tk-ty">long long</span> pairs = <span className="tk-num">0</span>;
              </span>
              <span className="ln">
                {'  '}
                <span className="tk-kw">for</span> (<span className="tk-ty">int</span> i ={' '}
                <span className="tk-num">0</span>; i &lt; n; ++i) {'{'}
              </span>
              <span className="ln">
                {'    '}
                <span className="tk-ty">long long</span> x; cin &gt;&gt; x;
              </span>
              <span className="ln is-active">
                {'    '}pairs += seen[k - x]; <span className="tk-com">{'// pairs ending at i'}</span>
              </span>
              <span className="ln">{'    '}seen[x]++;</span>
              <span className="ln">{'  }'}</span>
              <span className="ln">
                {'  '}cout &lt;&lt; pairs &lt;&lt; <span className="tk-str">&apos;\n&apos;</span>;
              </span>
              <span className="ln">{'}'}</span>
            </pre>
          </CodeEditorFrame>
        </div>
        <div className="flex flex-col gap-3 px-5 pt-1 pb-5">
          <TestProgress results={results} />
          <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
            <VerdictBadge verdict={verdict} />
            {done && (
              <span className="text-mono-label text-text-muted">{t('max', { time: '124 ms', memory: '15.2 MB' })}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const t = useTranslations('Landing.hero');
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-12 px-6 pt-16 pb-24 md:px-8"
    >
      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
        <p className="text-mono-label text-text-muted">{t('eyebrow')}</p>
        <h1 id="hero-title" className="text-display-lg lg:text-display-xl max-w-[14ch]">
          {t('title')}
        </h1>
        <p className="text-lead text-text-muted max-w-[52ch]">{t('lead')}</p>
        <div className="pt-2">
          <LandingActions />
        </div>
        <p className="text-small text-text-muted">{t('signInHint')}</p>
      </div>
      <div className="min-w-0 flex-[1_1_520px]">
        <SolvePreview />
      </div>
    </section>
  );
}
