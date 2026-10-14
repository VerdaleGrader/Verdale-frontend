'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

type Preference = 'system' | 'light' | 'dark';
const ORDER: Preference[] = ['system', 'light', 'dark'];
const STORAGE_KEY = 'verdale-theme';
const ICONS = { system: Monitor, light: Sun, dark: Moon };

function apply(preference: Preference) {
  // "system" removes the attribute so tokens.css follows prefers-color-scheme.
  if (preference === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', preference);
}

/** Script run before first paint (see app/layout.tsx) so a stored choice never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export function ThemeToggle() {
  const t = useTranslations('Theme');
  const [preference, setPreference] = useState<Preference>('system');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Reading storage is only possible after mount; this is the one-time sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === 'light' || stored === 'dark') setPreference(stored);
    } catch {
      /* storage blocked: stay on system */
    }
  }, []);

  const Icon = ICONS[preference];
  const label = t(preference);
  return (
    <Tooltip label={label} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={() => {
          const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!;
          setPreference(next);
          apply(next);
          try {
            if (next === 'system') localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, next);
          } catch {
            /* storage blocked: the choice lasts for this page only */
          }
        }}
      >
        <Icon aria-hidden />
      </Button>
    </Tooltip>
  );
}
