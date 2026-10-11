import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemStatus } from './system-status';

describe('SystemStatus', () => {
  it('shows a ready Core with its checks', async () => {
    render(<SystemStatus load={async () => ({ state: 'up', version: '0.1.0', checks: { database: true } })} />);
    expect(await screen.findByText('Core is ready')).toBeTruthy();
    expect(screen.getByText('0.1.0')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('pairs every state with text, never colour alone', async () => {
    render(<SystemStatus load={async () => ({ state: 'degraded', version: '0.1.0', checks: { database: false } })} />);
    expect(await screen.findByText('Core is up but not ready')).toBeTruthy();
    expect(screen.getByText('Failing')).toBeTruthy();
  });

  it('explains what to do when Core is unreachable', async () => {
    await act(async () => {
      render(<SystemStatus load={async () => ({ state: 'down' })} />);
    });
    expect(screen.getByText('Core is unreachable')).toBeTruthy();
    expect(screen.getByText(/npm run dev/)).toBeTruthy();
  });
});
