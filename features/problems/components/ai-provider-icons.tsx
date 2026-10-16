import type { SVGProps } from 'react';
import type { AiProvider } from '../types';

// lucide-react ships no brand marks, so these are inline and follow currentColor (design tokens only, no raw hex).
// They are simplified drawings of each mark, not the official artwork: swap in the brand files when they are supplied.

/** Claude: a burst of rays from one centre. */
function ClaudeIcon(props: SVGProps<SVGSVGElement>) {
  const rays = [
    [0, 10],
    [30, 7],
    [60, 10],
    [90, 7],
    [120, 10],
    [150, 7],
    [180, 10],
    [210, 7],
    [240, 10],
    [270, 7],
    [300, 10],
    [330, 7],
  ] as const;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      {rays.map(([angle, length]) => {
        const radians = (angle * Math.PI) / 180;
        const x = Math.sin(radians);
        const y = -Math.cos(radians);
        return <line key={angle} x1={12 + x * 2.5} y1={12 + y * 2.5} x2={12 + x * length} y2={12 + y * length} />;
      })}
    </svg>
  );
}

/** Gemini: a four-pointed sparkle with concave sides. */
function GeminiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5Z" />
    </svg>
  );
}

export function AiProviderIcon({ provider, ...props }: { provider: AiProvider } & SVGProps<SVGSVGElement>) {
  return provider === 'claude' ? <ClaudeIcon {...props} /> : <GeminiIcon {...props} />;
}
