export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function putJson(url: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function debouncePersist(fn: () => void, ms = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(fn, ms);
  };
}
