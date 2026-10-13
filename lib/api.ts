import type { components } from '@/lib/contracts/core-public.gen';
import { acceptTermsUrl, LEGAL_EXEMPT_PATHS } from '@/lib/legal';

type ErrorBody = components['schemas']['ErrorResponse'];

/** Every failed call to Core, in one shape: the standard ErrorResponse, or status 0 when Core cannot be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    readonly details: ErrorBody['details'] = [],
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The message Core gave for one field, if any (for form errors). */
  fieldError(field: string): string | undefined {
    return this.details?.find((detail) => detail.field === field)?.message;
  }
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'error_code' in value && 'message' in value;
}

const LEGAL_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';

/**
 * Core refuses every call of a signed-in person who has not accepted the current Terms and Privacy Policy
 * (GRD-122), for instance when the documents changed while a page was open: take them to the notice.
 */
function sendToAcceptTerms() {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (LEGAL_EXEMPT_PATHS.includes(pathname)) return;
  window.location.assign(acceptTermsUrl(pathname + search));
}

/** Turns an openapi-fetch result into the data, or throws an ApiError. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  const { data, error, response } = result;
  if (response.ok) return data as T;
  if (isErrorBody(error)) {
    if (error.error_code === LEGAL_REQUIRED) sendToAcceptTerms();
    throw new ApiError(error.status, error.error_code, error.message, error.details, error.request_id);
  }
  throw new ApiError(response.status, 'UNKNOWN', 'Something went wrong. Try again.');
}

/** Friendly text for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}
