'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard blocked: the text is selectable, nothing else to do. */
    }
  }
  return (
    <>
      <button type="button" className="vd-copy" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? (
          <Check className="size-3.5" strokeWidth={1.75} aria-hidden />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="vd-sr" role="status">
        {copied ? `${label} copied` : ''}
      </span>
    </>
  );
}

/** One sample: input and expected output side by side, exactly as the judge sees them. */
export function SampleIO({
  index,
  input,
  output,
  explanation,
}: {
  index?: number;
  input: string;
  output: string;
  explanation?: string;
}) {
  const suffix = index === undefined ? '' : ` ${index}`;
  return (
    <section className="vd-io" aria-label={`Sample${suffix}`}>
      {[
        { title: 'Input', text: input },
        { title: 'Output', text: output },
      ].map(({ title, text }) => (
        <div key={title} className="vd-io__pane">
          <div className="vd-io__bar">
            <span className="vd-io__title">
              {title}
              {suffix}
            </span>
            <CopyButton text={text} label={`${title.toLowerCase()}${suffix}`} />
          </div>
          {/* Never reflow or trim: the bytes are what the judge compares. */}
          <pre className="vd-io__pre" tabIndex={0}>
            {text}
          </pre>
        </div>
      ))}
      {explanation && <p className="vd-io__note">{explanation}</p>}
    </section>
  );
}
