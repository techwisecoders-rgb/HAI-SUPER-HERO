// Seed projects, popular queries, founders, and contact info.
// Sourced from the original single-file HAI SUPER HERO app.

import type { Project, PopularQuery } from "@/types";

export const PROJECTS: Project[] = [
  {
    id: "pr-1",
    title: "Aperture Studio",
    description: "Capturing Life's Most Precious Moments",
    image_url: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=1000&q=80",
    url: "https://photographer-one-phi.vercel.app/",
    sort_order: 0,
  },
  {
    id: "pr-2",
    title: "John Doe Studios",
    description: "Photography",
    image_url: "https://res.cloudinary.com/dsresihyk/image/upload/v1777382750/studio_config/xa3le0nxzy1e778rwml7.webp",
    url: "https://photography-mauve.vercel.app/",
    sort_order: 1,
  },
  {
    id: "pr-3",
    title: "Cafe Miracle Restaurant",
    description: "Where Every Bite Feels Like A Miracle",
    image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=80&auto=format&fit=crop",
    url: "https://cafe-miracle-sigma.vercel.app/",
    sort_order: 2,
  },
];

export const POPULAR_QUERIES: PopularQuery[] = [
  { id: "pq-1",  text: "I'm a software developer. Allot me projects", sort_order: 0 },
  { id: "pq-2",  text: "I need a full stack developer",             sort_order: 1 },
  { id: "pq-3",  text: "I need a android app developer",             sort_order: 2 },
  { id: "pq-4",  text: "I need a maths tutor",                       sort_order: 3 },
  { id: "pq-5",  text: "I am a driver. Search near..",               sort_order: 4 },
  { id: "pq-6",  text: "I'm a labour. You can allot works for me",   sort_order: 5 },
  { id: "pq-7",  text: "I need a electrician and plumber",           sort_order: 6 },
  { id: "pq-8",  text: "I need a photographer and videographer",     sort_order: 7 },
  { id: "pq-9",  text: "I need a computer technician",               sort_order: 8 },
  { id: "pq-10", text: "I need a graphic designer",                  sort_order: 9 },
  { id: "pq-11", text: "I need a delivery person",                   sort_order: 10 },
];

export const FOUNDERS = [
  { name: "T. Harsha Adharsh", role: "Founder" },
  { name: "P. Surya Koushik",  role: "Founder" },
] as const;

export const CONTACT = {
  // The original uses `tel:9963935878` in both the chat call button and the
  // About Us contact card.
  phone: "9963935878",
  email: "heawen.ias14319@gmail.com",
  privacyHref: "/privacy",
} as const;
