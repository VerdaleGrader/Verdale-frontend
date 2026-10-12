'use client';

import { PageContainer, PageHeader } from '@/components/layout/page';
import { Gallery } from './gallery';

/**
 * Every design-system component in one place, to review both themes side by side. Not linked from the app.
 * Each panel re-declares the theme on its own element, so the light and dark gallery are on screen together
 * whatever the header switch says.
 */
export default function DesignPage() {
  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title="Design system"
        description="Components as built in code, in the light theme and then in the dark theme."
      />
      {(['light', 'dark'] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          className="vd-themepanel border-border flex flex-col gap-6 rounded-lg border p-6"
          aria-label={`${theme} theme`}
          role="region"
        >
          <p className="text-mono-label text-text-muted">{theme} theme</p>
          <Gallery />
        </div>
      ))}
    </PageContainer>
  );
}
