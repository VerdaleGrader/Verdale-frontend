import { proxyToCore } from '@/lib/core-proxy';

// Read at request time, so the Worker's runtime variable is enough.
const handler = (request: Request) => proxyToCore(request, process.env.CORE_API_URL || 'http://localhost:8080');

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
