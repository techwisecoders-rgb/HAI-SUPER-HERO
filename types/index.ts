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

// ---------- authenticated business hub ----------

export type BusinessStatus = "draft" | "published" | "suspended";
export type BusinessEntryType = "item" | "service" | "vacancy";
export type BusinessOrderStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled";
export type BusinessDeliveryStatus =
  | "unassigned"
  | "assigned"
  | "out_for_delivery"
  | "delivered";

export interface BusinessProfile {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  owner_name: string | null;
  owner_bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  banner_image_url: string | null;
  logo_image_url: string | null;
  category: string | null;
  status: BusinessStatus;
  working_hours: Record<string, string> | null;
  rating_average: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BusinessListing {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  price: number | null;
  price_unit: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessDeliveryArea {
  id: string;
  business_id: string;
  area: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessSocialLink {
  id: string;
  business_id: string;
  platform: string;
  label: string | null;
  url: string;
  icon: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessReview {
  id: string;
  business_id: string;
  reviewer_name: string;
  rating: number;
  title: string | null;
  body: string;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessStaffRole {
  id: string;
  business_id: string;
  role_name: string;
  description: string | null;
  staff_count: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessEntry {
  id: string;
  business_id: string;
  listing_id: string | null;
  entry_type: BusinessEntryType;
  title: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessOrderItem {
  title: string;
  quantity?: number;
  price?: number;
  [key: string]: unknown;
}

export interface BusinessOrder {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address: string;
  items: BusinessOrderItem[];
  total_amount: number;
  status: BusinessOrderStatus;
  delivery_status: BusinessDeliveryStatus;
  delivery_boy_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  assigned_at: string | null;
  completed_at: string | null;
}

export interface BusinessDashboardData {
  profile: BusinessProfile | null;
  listings: BusinessListing[];
  delivery_areas: BusinessDeliveryArea[];
  social_links: BusinessSocialLink[];
  reviews: BusinessReview[];
  staff_roles: BusinessStaffRole[];
  entries: BusinessEntry[];
  orders: BusinessOrder[];
}

/** Camel-case fields accepted by the business API. */
export interface BusinessProfileInput {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  ownerName?: string;
  ownerBio?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  bannerImageUrl?: string;
  logoImageUrl?: string;
  category?: string;
  status?: BusinessStatus;
  workingHours?: Record<string, string> | null;
}

export type BusinessResourceName =
  | "listings"
  | "delivery-areas"
  | "social-links"
  | "reviews"
  | "staff"
  | "entries"
  | "orders";