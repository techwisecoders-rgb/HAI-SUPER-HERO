// Seed categories for the Trending Works page.
// Sourced from the original single-file HAI SUPER HERO app.
//
// IMPORTANT: The order here is the **visual carousel order** (which is what
// the user sees). The original app's `onclick="selectCategory(N)"` indices on
// the category pills were intentionally scrambled (e.g. the first pill calls
// selectCategory(0) → Technical, but the second pill calls selectCategory(3)
// → Educational). We deliberately do NOT replicate that bug — the pills here
// are wired to their actual index. See /app/trending/page.tsx for the pills.

import type { Category } from "@/types";

export const CATEGORIES: Category[] = [
  {
    id: "cat-technical", slug: "technical", name: "Technical Aspects", sort_order: 0,
    items: [
      { id: "ci-tech-1", category_id: "cat-technical", image_url: "https://tse2.mm.bing.net/th/id/OIP.p2-dfTeU_QzIsVqFMuX-wQHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3", caption: "Software Development",  sort_order: 0 },
      { id: "ci-tech-2", category_id: "cat-technical", image_url: "https://tse1.mm.bing.net/th/id/OIP.qzJEXGOGnKQNrAXgoqY7JQHaHa?r=0&w=2000&h=2000&rs=1&pid=ImgDetMain&o=7&rm=3", caption: "Web Application",       sort_order: 1 },
      { id: "ci-tech-3", category_id: "cat-technical", image_url: "https://tse1.mm.bing.net/th/id/OIP.i0Q_HYw06GhA0oJRmXQH5QHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",     caption: "Android Application",   sort_order: 2 },
      { id: "ci-tech-4", category_id: "cat-technical", image_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1400",                       caption: "Artificial Intelligence", sort_order: 3 },
    ],
  },
  {
    id: "cat-educational", slug: "educational", name: "Educational Works", sort_order: 1,
    items: [
      { id: "ci-edu-1", category_id: "cat-educational", image_url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1400", caption: "Teacher",         sort_order: 0 },
      { id: "ci-edu-2", category_id: "cat-educational", image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1400", caption: "Private Tutor",   sort_order: 1 },
      { id: "ci-edu-3", category_id: "cat-educational", image_url: "https://images.unsplash.com/photo-1516321165247-4aa89a48be28?w=1400", caption: "Software developer", sort_order: 2 },
      { id: "ci-edu-4", category_id: "cat-educational", image_url: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400", caption: "Skill Trainer",   sort_order: 3 },
    ],
  },
  {
    id: "cat-business", slug: "business", name: "Business Works", sort_order: 2,
    items: [
      { id: "ci-biz-1", category_id: "cat-business", image_url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400", caption: "Digital Marketing", sort_order: 0 },
      { id: "ci-biz-2", category_id: "cat-business", image_url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400", caption: "Business Analyst",  sort_order: 1 },
      { id: "ci-biz-3", category_id: "cat-business", image_url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400", caption: "Sales",            sort_order: 2 },
      { id: "ci-biz-4", category_id: "cat-business", image_url: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1400", caption: "Management",       sort_order: 3 },
    ],
  },
  {
    id: "cat-personal", slug: "personal", name: "Personal Works", sort_order: 3,
    items: [
      { id: "ci-per-1", category_id: "cat-personal", image_url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400", caption: "Personal Assistant", sort_order: 0 },
      { id: "ci-per-2", category_id: "cat-personal", image_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1400", caption: "Fitness Trainer",   sort_order: 1 },
      { id: "ci-per-3", category_id: "cat-personal", image_url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400", caption: "Beauty Services",   sort_order: 2 },
      { id: "ci-per-4", category_id: "cat-personal", image_url: "https://images.unsplash.com/photo-1507504031003-b417219a0fde?w=1400", caption: "Event Support",     sort_order: 3 },
    ],
  },
  {
    id: "cat-creative", slug: "creative", name: "Creative Works", sort_order: 4,
    items: [
      { id: "ci-cre-1", category_id: "cat-creative", image_url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1400", caption: "Graphic Designer", sort_order: 0 },
      { id: "ci-cre-2", category_id: "cat-creative", image_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1400", caption: "Video Editor",     sort_order: 1 },
      { id: "ci-cre-3", category_id: "cat-creative", image_url: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?w=1400", caption: "Photographer",     sort_order: 2 },
      { id: "ci-cre-4", category_id: "cat-creative", image_url: "https://images.unsplash.com/photo-1492724441997-5dc865305da7?w=1400", caption: "Content Creator",  sort_order: 3 },
    ],
  },
  {
    id: "cat-home", slug: "home", name: "Home Works", sort_order: 5,
    items: [
      { id: "ci-home-1", category_id: "cat-home", image_url: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1400", caption: "Electrician",   sort_order: 0 },
      { id: "ci-home-2", category_id: "cat-home", image_url: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1400", caption: "Plumber",       sort_order: 1 },
      { id: "ci-home-3", category_id: "cat-home", image_url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1400", caption: "Painter",       sort_order: 2 },
      { id: "ci-home-4", category_id: "cat-home", image_url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1400", caption: "Carpenter",     sort_order: 3 },
      { id: "ci-home-5", category_id: "cat-home", image_url: "https://images.unsplash.com/photo-1631545806609-7f7f7f7f7f7f?w=1400", caption: "AC Technician", sort_order: 4 },
    ],
  },
  {
    id: "cat-transport", slug: "transport", name: "Transport Works", sort_order: 6,
    items: [
      { id: "ci-trn-1", category_id: "cat-transport", image_url: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1400", caption: "Driver",          sort_order: 0 },
      { id: "ci-trn-2", category_id: "cat-transport", image_url: "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=1400", caption: "Delivery",        sort_order: 1 },
      { id: "ci-trn-3", category_id: "cat-transport", image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1400", caption: "Logistics",       sort_order: 2 },
      { id: "ci-trn-4", category_id: "cat-transport", image_url: "https://images.unsplash.com/photo-1600510340122-9c4f0f4f5f8f?w=1400", caption: "Moving Services", sort_order: 3 },
    ],
  },
];
