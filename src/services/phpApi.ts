/**
 * PHP Backend API Client for InfinityFree Production Hosting
 * Connects to /php-backend/api/*.php with session cookies.
 */
const API_BASE = '/php-backend/api';

export async function phpApiGet<T>(endpoint: string, action: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}.php?action=${encodeURIComponent(action)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function phpApiPost<T>(endpoint: string, action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}.php?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function phpApiPostForm<T>(endpoint: string, action: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}.php?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}
