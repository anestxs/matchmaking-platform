const API_URL = process.env.NEXT_PUBLIC_API_URL;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function request(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
}

async function parse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { message?: string | string[] })?.message;
    throw new ApiError(
      response.status,
      Array.isArray(message) ? message.join(', ') : (message ?? response.statusText),
    );
  }

  return body as T;
}

async function refresh(): Promise<string | null> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    accessToken = null;
    return null;
  }

  const { accessToken: token } = (await response.json()) as { accessToken: string };
  accessToken = token;
  return token;
}

export function refreshSession(): Promise<string | null> {
  refreshPromise ??= refresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const NO_REFRESH_PATHS = [
    '/auth/refresh',
    '/auth/login',
    '/auth/register',
    '/auth/password/forgot',
    '/auth/password/reset',
    '/auth/email/verify',
  ];

  const response = await request(path, init);

  if (response.status !== 401 || NO_REFRESH_PATHS.includes(path)) {
    return parse<T>(response);
  }

  const token = await refreshSession();

  if (!token) {
    return parse<T>(response);
  }

  return parse<T>(await request(path, init));
}
