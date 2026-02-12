/**
 * Shared Asana API client. Uses ASANA_API_KEY server-side only.
 */

const ASANA_BASE = "https://app.asana.com/api/1.0";

export function getAsanaBase(): string {
  return ASANA_BASE;
}

export async function asanaFetch<T = unknown>(url: string): Promise<T> {
  const key = process.env.ASANA_API_KEY;
  if (!key) {
    throw new Error("ASANA_API_KEY is not configured");
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asana API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
