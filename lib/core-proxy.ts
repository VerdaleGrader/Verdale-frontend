const HOP_BY_HOP_HEADERS = ['host', 'connection', 'content-length', 'transfer-encoding'];
const DECODED_RESPONSE_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

/**
 * Forwards a browser request to Core without following redirects, so the
 * browser itself receives Core's 302 (OAuth sign-in) and every Set-Cookie.
 * A plain rewrite follows the redirect on the server and returns the
 * provider's page under our own URL.
 */
export async function proxyToCore(request: Request, coreBaseUrl: string): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, coreBaseUrl);

  const forwardedHeaders = new Headers(request.headers);
  for (const headerName of HOP_BY_HOP_HEADERS) forwardedHeaders.delete(headerName);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const coreResponse = await fetch(targetUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    // Required by Node/undici when streaming a request body.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  const responseHeaders = new Headers(coreResponse.headers);
  for (const headerName of DECODED_RESPONSE_HEADERS) responseHeaders.delete(headerName);
  responseHeaders.delete('set-cookie');
  for (const cookie of coreResponse.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);

  return new Response(coreResponse.body, {
    status: coreResponse.status,
    statusText: coreResponse.statusText,
    headers: responseHeaders,
  });
}
