import { setSession, state } from './store.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && state.user && !path.startsWith('/api/auth/')) {
    setSession('', null);
    location.hash = '/masuk';
  }
  if (!response.ok) throw new ApiError(response.status, data.error || 'Terjadi kesalahan.');
  return data;
}
