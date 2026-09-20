export interface WorkerProfile {
  name: string; phone: string; email: string | null; location: string;
  qualification: string; experience: string; profession: string;
  profile_image_url: string | null; background_image_url: string | null;
  work_available: boolean; skills: string[]; about_text: string;
  work_description: string; resume_url: string | null;
  works: { type: string; content: string }[];
  featured: string[]; social_links: { label: string; url: string }[];
  rating: number; jobs_done: number;
}
export const emptyProfile: WorkerProfile = {
  name: "", phone: "", email: null, location: "", qualification: "", experience: "",
  profession: "electrician", profile_image_url: null, background_image_url: null,
  work_available: true, skills: [], about_text: "", work_description: "",
  resume_url: null, works: [], featured: [], social_links: [], rating: 0, jobs_done: 0,
};
export async function workerFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  if (!data) throw new Error("The server returned an invalid response.");
  return data as T;
}
export function safeLink(value: string): string | undefined {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
export async function uploadWorkerFile(file: File, allowPdf = false) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", ...(allowPdf ? ["application/pdf"] : [])];
  if (!allowed.includes(file.type)) throw new Error(allowPdf ? "Choose a PDF, JPG, PNG, WebP or GIF." : "Choose a JPG, PNG, WebP or GIF image.");
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Files must be non-empty and no larger than 5 MB.");
  const body = new FormData(); body.append("file", file);
  return (await workerFetch<{ url: string }>("/api/worker/profile/upload", { method: "POST", body })).url;
}
