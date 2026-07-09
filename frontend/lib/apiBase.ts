/** Base URL for the Express API (includes /api/v1). */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
}

export function parseApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') return d.error;
  if (typeof d.message === 'string') return d.message;
  if (Array.isArray(d.errors) && d.errors[0] && typeof d.errors[0] === 'object') {
    const first = d.errors[0] as { msg?: string };
    if (first.msg) return first.msg;
  }
  return fallback;
}
