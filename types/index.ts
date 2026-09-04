// Shared TypeScript types used by both the React app and Route Handlers.

/**
 * Sender types for a chat message.
 *  - "user"  : the visitor's own message
 *  - "admin" : a real admin (human) reply — stops the "thinking" indicator
 *  - "auto"  : an automated/bot reply — styled differently from admin
 *              replies but does NOT stop the "thinking" indicator (so a
 *              real human reply can still follow).
 */
export type SenderType = "user" | "admin" | "auto";

export interface Session {
  id: string;
  created_at: string;
  last_seen_at: string;
  last_read_by_admin_at?: string | null;
  display_name: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Message {
  id: string;
  session_id: string;
  sender_type: SenderType;
  admin_id: string | null;
  text: string;
  created_at: string;
}

export interface Admin {
  id: string;
  email: string;
  display_name: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  items: CategoryItem[];
}

export interface CategoryItem {
  id: string;
  category_id: string;
  image_url: string;
  caption: string;
  sort_order: number;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  url: string;
  sort_order: number;
}

export interface PopularQuery {
  id: string;
  text: string;
  sort_order: number;
}

/**
 * Worker registration profile — submitted from /register.
 * Mirrors the form in the reference HTML. */
export interface WorkerRegistration {
  id: string;
  created_at: string;
  session_id: string | null;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  work_type: string;
  work_description: string;
  qualification: string | null;
  years_experience: string | null;
  availability: string | null;
}

/** Admin-editable contact numbers used by the chat welcome row. */
export interface ContactSettings {
  phone: string;
  whatsapp: string;
}
