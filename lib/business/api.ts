export async function businessFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(options?.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed with status ${response.status}`);
  return data as T;
}

export const updateBusinessProfile = (payload: Record<string, unknown>) =>
  businessFetch<{ profile: unknown }>("/api/business", { method: "PATCH", body: JSON.stringify(payload) });

export const createBusinessResource = (resource: string, payload: Record<string, unknown>) =>
  businessFetch<{ item: unknown }>(`/api/business/${resource}`, { method: "POST", body: JSON.stringify(payload) });

export const updateBusinessResource = (resource: string, id: string, payload: Record<string, unknown>) =>
  businessFetch<{ item: unknown }>(`/api/business/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteBusinessResource = (resource: string, id: string) =>
  businessFetch<{ ok: boolean }>(`/api/business/${resource}/${id}`, { method: "DELETE" });

export async function uploadBusinessImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF image.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Files must be non-empty and no larger than 5 MB.");
  const form = new FormData();
  form.append("file", file);
  return businessFetch<{ url: string }>("/api/business/upload", { method: "POST", body: form });
}
