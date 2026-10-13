import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyToCore } from './core-proxy';

afterEach(() => vi.unstubAllGlobals());

describe('proxyToCore', () => {
  it('passes a redirect and all cookies through instead of following them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: [
          ['location', 'https://accounts.google.com/o/oauth2/v2/auth?state=abc'],
          ['set-cookie', 'vd_oauth=1; Path=/; HttpOnly'],
          ['set-cookie', 'other=2; Path=/'],
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyToCore(
      new Request('https://verdale.kanonkc.com/api/v1/auth/oauth/google/start?redirect=%2Fspaces'),
      'https://core.example.com'
    );

    const [targetUrl, init] = fetchMock.mock.calls[0];
    expect(String(targetUrl)).toBe('https://core.example.com/api/v1/auth/oauth/google/start?redirect=%2Fspaces');
    expect(init.redirect).toBe('manual');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('accounts.google.com');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('forwards method, body and cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await proxyToCore(
      new Request('https://verdale.kanonkc.com/api/v1/spaces', {
        method: 'POST',
        headers: { cookie: 'vd_session=s', origin: 'https://verdale.kanonkc.com', 'content-type': 'application/json' },
        body: '{"name":"x"}',
      }),
      'https://core.example.com'
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('cookie')).toBe('vd_session=s');
    expect(new Headers(init.headers).get('origin')).toBe('https://verdale.kanonkc.com');
  });
});
