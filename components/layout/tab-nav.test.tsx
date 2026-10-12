import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabNav } from './tab-nav';

const path = vi.hoisted(() => ({ value: '/spaces/team' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.value }));

const items = [
  { href: '/spaces/team', label: 'Overview' },
  { href: '/spaces/team/members', label: 'Members' },
  { href: '/spaces/team/submissions', label: 'Submissions', matchPrefix: true },
];

describe('TabNav', () => {
  it('marks the tab of the page', () => {
    path.value = '/spaces/team/members';
    render(<TabNav items={items} label="Space sections" />);
    expect(screen.getByRole('link', { name: 'Members' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps a prefix tab marked on a page below it, and never lets Overview claim every page', () => {
    path.value = '/spaces/team/submissions/members/ploys';
    render(<TabNav items={items} label="Space sections" />);
    expect(screen.getByRole('link', { name: 'Submissions' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
  });
});
