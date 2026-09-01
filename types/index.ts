// Shared TypeScript types used by both the React app and Route Handlers.

export type SenderType = "user" | "admin";

export interface Session {
  id: string;
  created_at: string;
  last_seen_at: string;
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
