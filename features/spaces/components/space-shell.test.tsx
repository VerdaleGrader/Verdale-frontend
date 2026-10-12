import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetNavigation } from '@/features/test-navigation';
import { makeSpace, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => import('@/features/test-navigation'));

import { SpaceChrome } from './space-shell';

beforeEach(() => resetNavigation('/spaces/team', { slug: 'team' }));

describe('Space tabs', () => {
  it.each(['owner', 'administrator', 'editor', 'observer'] as const)('%s has a Submissions tab', (role) => {
    renderInApp(<SpaceChrome>x</SpaceChrome>, { space: makeSpace(role) });
    expect(screen.getByRole('link', { name: 'Submissions' }).getAttribute('href')).toBe('/spaces/team/submissions');
  });

  it.each(['solver', null] as const)('%s has none', (role) => {
    renderInApp(<SpaceChrome>x</SpaceChrome>, { space: makeSpace(role) });
    expect(screen.queryByRole('link', { name: 'Submissions' })).toBeNull();
  });

  it('marks it on a page below it', () => {
    resetNavigation('/spaces/team/submissions/members/ploys', { slug: 'team' });
    renderInApp(<SpaceChrome>x</SpaceChrome>, { space: makeSpace('editor') });
    expect(screen.getByRole('link', { name: 'Submissions' }).getAttribute('aria-current')).toBe('page');
  });
});
