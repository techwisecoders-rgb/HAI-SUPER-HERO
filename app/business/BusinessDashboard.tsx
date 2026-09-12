"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessDashboardData, BusinessProfile } from "@/types";
import { useAuth } from "@/lib/use-auth";
import ResourceSection, { type ResourceField } from "./ResourceSection";
import styles from "./page.module.css";

const EMPTY_DASHBOARD: BusinessDashboardData = {
  profile: null,
  listings: [],
  delivery_areas: [],
  social_links: [],
  reviews: [],
  staff_roles: [],
  entries: [],
  orders: [],
};

const PROFILE_FIELDS: ResourceField[] = [
  { key: "name", label: "Business name", required: true, help: "e.g. Green Harvest Grocers" },
  { key: "tagline", label: "Tagline", help: "A short promise or slogan" },
  { key: "description", label: "About your business", type: "textarea", help: "Tell customers what makes you different" },
  { key: "ownerName", label: "Owner name", help: "The person customers can trust" },
  { key: "ownerBio", label: "Owner bio", type: "textarea", help: "Experience, values, or story" },
  { key: "phone", label: "Phone", help: "+91 98765 43210" },
  { key: "email", label: "Contact email", help: "name@business.com" },
  { key: "website", label: "Website", help: "https://yourbusiness.com" },
  { key: "address", label: "Street address", help: "Shop or office address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "category", label: "Category", help: "Retail, food, health, services..." },
  { key: "bannerImageUrl", label: "Banner image URL", help: "https://..." },
  { key: "logoImageUrl", label: "Logo image URL", help: "https://..." },
  { key: "status", label: "Visibility", type: "select", options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "suspended", label: "Suspended" },
  ] },
  { key: "workingHours", label: "Working hours (JSON)", type: "json", help: '{"Mon":"9:00-18:00","Sun":"Closed"}' },
];

function profileFormFrom(profile: BusinessProfile | null) {
  return {
    name: profile?.name ?? "",
    tagline: profile?.tagline ?? "",
    description: profile?.description ?? "",
    ownerName: profile?.owner_name ?? "",
    ownerBio: profile?.owner_bio ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    website: profile?.website ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    postalCode: profile?.postal_code ?? "",
    country: profile?.country ?? "",
    bannerImageUrl: profile?.banner_image_url ?? "",
    logoImageUrl: profile?.logo_image_url ?? "",
    category: profile?.category ?? "",
    status: profile?.status ?? "draft",
    workingHours: JSON.stringify(profile?.working_hours ?? {}, null, 2),
  };
}

export default function BusinessDashboard() {
  const router = useRouter();
  const { email } = useAuth();
  const [data, setData] = useState<BusinessDashboardData>(EMPTY_DASHBOARD);
  const [profileForm, setProfileForm] = useState(() => profileFormFrom(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business", { credentials: "same-origin" });
      if (response.status === 401) {
        router.replace(`/auth?next=${encodeURIComponent("/business")}`);
        return;
      }
      if (!response.ok) throw new Error("Could not load your business dashboard");
      const payload = (await response.json()) as BusinessDashboardData;
      setData(payload);
      setProfileForm(profileFormFrom(payload.profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);

  function updateProfile(key: string, value: string) {
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    let workingHours: Record<string, string> = {};
    try {
      const parsed = JSON.parse(profileForm.workingHours || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Use an object");
      workingHours = parsed as Record<string, string>;
    } catch {
      setNotice({ kind: "err", text: "Working hours must be valid JSON, for example {\"Mon\":\"9:00-18:00\"}." });
      setSaving(false);
      return;
    }
    const payload = { ...profileForm, workingHours };
    try {
      const response = await fetch("/api/business", {
        method: data.profile ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; profile?: BusinessProfile } | null;
      if (!response.ok || result?.error) throw new Error(result?.error ?? "Could not save profile");
      const savedProfile = result?.profile;
      if (!savedProfile) throw new Error("Could not save business profile");
      setData((current) => ({ ...current, profile: savedProfile }));
      setProfileForm(profileFormFrom(savedProfile));
      setNotice({ kind: "ok", text: data.profile ? "Business profile updated." : "Business profile created. You can now add listings and manage orders." });
      await refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth?next=/business");
  }

  const profile = data.profile;
  const totalOrders = data.orders?.length ?? 0;
  const pendingOrders = data.orders?.filter((order) => order.status === "pending").length ?? 0;
  const averageRating = data.reviews?.length
    ? data.reviews.reduce((sum, review) => sum + review.rating, 0) / data.reviews.length
    : 0;

  function profileValue(key: string) {
    return profileForm[key as keyof typeof profileForm] as string;
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <span className={styles.logoMark}>H</span>
          <p>Opening your business workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/business">
          <span className={styles.logoMark}>H</span>
          <span><strong>HAI SUPER HERO</strong><small>BUSINESS HUB</small></span>
        </a>
        <div className={styles.accountActions}>
          <span className={styles.accountEmail}>{email || "Business owner"}</span>
          <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>Sign out</button>
        </div>
      </header>

      {error && <div className={styles.pageNotice}><span className={styles.formError}>{error}</span></div>}
      {notice && <div className={styles.pageNotice}><span className={notice.kind === "err" ? styles.formError : styles.formOk}>{notice.text}</span></div>}

      {!profile ? (
        <section className={styles.onboarding}>
          <div className={styles.onboardingCopy}>
            <span className={styles.eyebrow}>WELCOME, OWNER</span>
            <h1>Turn your business into a digital storefront.</h1>
            <p>Create your profile once, then manage listings, delivery areas, social links, reviews, staff, entries, and orders from one secure workspace.</p>
            <div className={styles.featureList}>
              <span>✓ Owner-scoped data</span><span>✓ Order workflow</span><span>✓ Delivery coverage</span><span>✓ Public-ready profile</span>
            </div>
          </div>
          <form className={styles.profileCard} onSubmit={saveProfile}>
            <div className={styles.cardHeading}>
              <span className={styles.stepNumber}>01</span>
              <div><span className={styles.eyebrow}>START HERE</span><h2>Register your business</h2><p>We will use this information across your dashboard.</p></div>
            </div>
            <div className={styles.profileFields}>
              {PROFILE_FIELDS.slice(0, 17).map((field) => (
                <label className={`${styles.field} ${field.type === "textarea" ? styles.fieldWide : ""}`} key={field.key}>
                  <span>{field.label}{field.required && <b> *</b>}</span>
                  {field.type === "textarea" ? (
                    <textarea required={field.required} value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)} placeholder={field.help} />
                  ) : field.type === "select" ? (
                    <select value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)}>
                      <option value="draft">Draft</option><option value="published">Published</option><option value="suspended">Suspended</option>
                    </select>
                  ) : (
                    <input required={field.required} value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)} placeholder={field.help} />
                  )}
                </label>
              ))}
            </div>
            <button className={styles.primaryBtn} disabled={saving}>{saving ? "Creating your profile..." : "Create business profile"}</button>
          </form>
        </section>
      ) : (
        <>
          <section className={styles.hero}>
            <div><span className={styles.eyebrow}>BUSINESS CONSOLE</span><h1>Good to see you, {profile.owner_name || profile.name}.</h1><p>Keep your storefront accurate and your operations moving.</p></div>
            <div className={styles.profileBadge}><span className={styles.liveDot} />{profile.status === "published" ? "Published" : "Draft profile"}</div>
          </section>

          <section className={styles.metrics}>
            <div><span>Active listings</span><strong>{data.listings?.filter((item) => item.active).length ?? 0}</strong><small>{data.listings?.length ?? 0} total</small></div>
            <div><span>Delivery areas</span><strong>{data.delivery_areas?.filter((item) => item.active).length ?? 0}</strong><small>service coverage</small></div>
            <div><span>Open orders</span><strong>{pendingOrders}</strong><small>{totalOrders} total orders</small></div>
            <div><span>Average rating</span><strong>{averageRating.toFixed(1)}<small className={styles.metricStar}> ★</small></strong><small>{data.reviews?.length ?? 0} reviews</small></div>
          </section>

          <section className={styles.section} id="profile">
            <div className={styles.sectionHeading}>
              <div><h2>Business profile</h2><p>Edit the public details customers see on your storefront.</p></div>
              <span className={styles.countPill}>Public</span>
            </div>
            <form className={styles.profileCard} onSubmit={saveProfile}>
              <div className={styles.profileFields}>
                {PROFILE_FIELDS.map((field) => (
                  <label className={`${styles.field} ${field.type === "textarea" || field.type === "json" ? styles.fieldWide : ""}`} key={field.key}>
                    <span>{field.label}{field.required && <b> *</b>}</span>
                    {field.type === "textarea" ? (
                      <textarea required={field.required} value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)} placeholder={field.help} />
                    ) : field.type === "json" ? (
                      <textarea className={styles.codeInput} required={field.required} value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)} placeholder={field.help} />
                    ) : field.type === "select" ? (
                      <select value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)}>
                        <option value="draft">Draft</option><option value="published">Published</option><option value="suspended">Suspended</option>
                      </select>
                    ) : (
                      <input required={field.required} value={profileValue(field.key)} onChange={(event) => updateProfile(field.key, event.target.value)} placeholder={field.help} />
                    )}
                  </label>
                ))}
              </div>
              <div className={styles.formActions}><button className={styles.primaryBtn} disabled={saving}>{saving ? "Saving..." : "Save profile changes"}</button></div>
            </form>
          </section>

          <ResourceSection
            resource="listings"
            title="Listings"
            blurb="Show the products, services, or offers customers can browse."
            items={data.listings.map((item) => ({ ...item, imageUrl: item.image_url, priceUnit: item.price_unit, sortOrder: item.sort_order }))}
            fields={[
              { key: "title", label: "Title", required: true },
              { key: "description", label: "Description", type: "textarea" },
              { key: "imageUrl", label: "Image URL" },
              { key: "category", label: "Category" },
              { key: "price", label: "Price", type: "number" },
              { key: "priceUnit", label: "Price unit", help: "per kg, per hour..." },
              { key: "active", label: "Active", type: "checkbox" },
              { key: "sortOrder", label: "Display order", type: "number" },
            ]}
            columns={[
              { key: "title", label: "Title" },
              { key: "category", label: "Category", format: (value) => String(value || "General") },
              { key: "price", label: "Price", format: (value) => value === null || value === undefined ? "—" : `₹${Number(value).toFixed(2)}` },
              { key: "active", label: "Status", format: (value) => <span className={value ? styles.activePill : styles.inactivePill}>{value ? "Active" : "Inactive"}</span> },
            ]}
            defaults={{ title: "", description: "", imageUrl: "", category: "", price: 0, priceUnit: "", active: true, sortOrder: 0 }}
            emptyMessage="No listings yet. Add your first product or service above."
            onSaved={() => void refresh()}
          />

          <ResourceSection
            resource="delivery-areas"
            title="Delivery areas"
            blurb="Tell customers exactly where your business delivers."
            items={data.delivery_areas.map((item) => ({ ...item, postalCode: item.postal_code, sortOrder: item.sort_order }))}
            fields={[
              { key: "area", label: "Area", required: true },
              { key: "city", label: "City" },
              { key: "state", label: "State" },
              { key: "postalCode", label: "Postal code" },
              { key: "active", label: "Active", type: "checkbox" },
              { key: "sortOrder", label: "Display order", type: "number" },
            ]}
            columns={[
              { key: "area", label: "Area" },
              { key: "city", label: "City", format: (value) => String(value || "—") },
              { key: "postalCode", label: "Postal code", format: (value) => String(value || "—") },
              { key: "active", label: "Status", format: (value) => <span className={value ? styles.activePill : styles.inactivePill}>{value ? "Active" : "Inactive"}</span> },
            ]}
            defaults={{ area: "", city: "", state: "", postalCode: "", active: true, sortOrder: 0 }}
            emptyMessage="No delivery areas yet. Add your first service location above."
            onSaved={() => void refresh()}
          />

          <ResourceSection
            resource="social-links"
            title="Social links"
            blurb="Connect customers with your business across every channel."
            items={data.social_links.map((item) => ({ ...item, sortOrder: item.sort_order }))}
            fields={[
              { key: "platform", label: "Platform", required: true, help: "Instagram, Facebook, WhatsApp..." },
              { key: "label", label: "Label" },
              { key: "url", label: "Profile URL", required: true },
              { key: "icon", label: "Icon name" },
              { key: "active", label: "Active", type: "checkbox" },
              { key: "sortOrder", label: "Display order", type: "number" },
            ]}
            columns={[
              { key: "platform", label: "Platform" },
              { key: "label", label: "Label", format: (value) => String(value || "Visit profile") },
              { key: "url", label: "URL", format: (value) => <a className={styles.linkCell} href={String(value)} target="_blank" rel="noreferrer">Open ↗</a> },
              { key: "active", label: "Status", format: (value) => <span className={value ? styles.activePill : styles.inactivePill}>{value ? "Active" : "Inactive"}</span> },
            ]}
            defaults={{ platform: "", label: "", url: "", icon: "", active: true, sortOrder: 0 }}
            emptyMessage="No social links yet. Add a channel your customers can follow."
            onSaved={() => void refresh()}
          />

          <ResourceSection
            resource="reviews"
            title="Customer reviews"
            blurb="Curate trustworthy feedback and highlight your best experiences."
            items={data.reviews?.map((item) => ({ ...item, reviewerName: item.reviewer_name })) ?? []}
            fields={[
              { key: "reviewerName", label: "Reviewer name", required: true },
              { key: "rating", label: "Rating", type: "number", required: true },
              { key: "title", label: "Review title" },
              { key: "body", label: "Review", type: "textarea", required: true },
              { key: "approved", label: "Approved", type: "checkbox" },
            ]}
            columns={[
              { key: "reviewerName", label: "Reviewer" },
              { key: "rating", label: "Rating", format: (value) => <span className={styles.ratingCell}>★ {String(value)}</span> },
              { key: "title", label: "Title", format: (value) => String(value || "—") },
              { key: "approved", label: "Moderation", format: (value) => <span className={value ? styles.activePill : styles.inactivePill}>{value ? "Approved" : "Pending"}</span> },
            ]}
            defaults={{ reviewerName: "", rating: 5, title: "", body: "", approved: false }}
            emptyMessage="No reviews yet. Add a testimonial or import customer feedback."
            onSaved={() => void refresh()}
          />

          <ResourceSection
            resource="entries"
            title="Entries"
            blurb="Organize portfolio items, services, vacancies, or other business content."
            items={data.entries.map((item) => ({ ...item, listingId: item.listing_id, entryType: item.entry_type, imageUrl: item.image_url, sortOrder: item.sort_order }))}
            fields={[
              { key: "listingId", label: "Linked listing", type: "select", options: data.listings.map((listing) => ({ value: listing.id, label: listing.title })) },
              { key: "entryType", label: "Entry type", type: "select", options: [
                { value: "item", label: "Item" }, { value: "service", label: "Service" }, { value: "vacancy", label: "Vacancy" },
              ] },
              { key: "title", label: "Title", required: true },
              { key: "description", label: "Description", type: "textarea" },
              { key: "imageUrl", label: "Image URL" },
              { key: "price", label: "Price", type: "number" },
              { key: "active", label: "Active", type: "checkbox" },
              { key: "sortOrder", label: "Display order", type: "number" },
            ]}
            columns={[
              { key: "title", label: "Title" },
              { key: "entryType", label: "Type", format: (value) => String(value || "item") },
              { key: "price", label: "Price", format: (value) => value === null || value === undefined ? "—" : `₹${Number(value).toFixed(2)}` },
              { key: "active", label: "Status", format: (value) => <span className={value ? styles.activePill : styles.inactivePill}>{value ? "Active" : "Inactive"}</span> },
            ]}
            defaults={{ listingId: "", entryType: "item", title: "", description: "", imageUrl: "", price: 0, active: true, sortOrder: 0 }}
            emptyMessage="No entries yet. Add your first item, service, or vacancy above."
            onSaved={() => void refresh()}
          />

          <ResourceSection
            resource="orders"
            title="Orders"
            blurb="Review customer requests and move each order through your delivery workflow."
            items={data.orders?.map((item) => ({
              ...item,
              customerName: item.customer_name,
              customerPhone: item.customer_phone,
              customerEmail: item.customer_email,
              totalAmount: item.total_amount,
              deliveryStatus: item.delivery_status,
              deliveryBoyName: item.delivery_boy_name,
              items: JSON.stringify(item.items, null, 2),
            })) ?? []}
            fields={[
              { key: "customerName", label: "Customer name", required: true },
              { key: "customerPhone", label: "Customer phone", required: true },
              { key: "customerEmail", label: "Customer email" },
              { key: "address", label: "Delivery address", required: true },
              { key: "items", label: "Order items (JSON)", type: "json", required: true, help: '[{"title":"Product","quantity":2,"price":100}]' },
              { key: "totalAmount", label: "Total amount", type: "number", required: true },
              { key: "status", label: "Order status", type: "select", options: [
                { value: "pending", label: "Pending" }, { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
              ] },
              { key: "deliveryStatus", label: "Delivery status", type: "select", options: [
                { value: "unassigned", label: "Unassigned" }, { value: "assigned", label: "Assigned" }, { value: "out_for_delivery", label: "Out for delivery" }, { value: "delivered", label: "Delivered" },
              ] },
              { key: "deliveryBoyName", label: "Delivery partner" },
              { key: "notes", label: "Notes", type: "textarea" },
            ]}
            columns={[
              { key: "customerName", label: "Customer" },
              { key: "totalAmount", label: "Total", format: (value) => `₹${Number(value ?? 0).toFixed(2)}` },
              { key: "status", label: "Order", format: (value) => <span className={styles.statusPill}>{String(value)}</span> },
              { key: "deliveryStatus", label: "Delivery", format: (value) => <span className={styles.statusPill}>{String(value).replace(/_/g, " ")}</span> },
            ]}
            defaults={{ customerName: "", customerPhone: "", customerEmail: "", address: "", items: "[]", totalAmount: 0, status: "pending", deliveryStatus: "unassigned", deliveryBoyName: "", notes: "" }}
            emptyMessage="No orders yet. New customer orders will appear here."
            actions={(item) => [
              { label: "Accept", payload: { status: "accepted" }, hidden: (order) => order.status !== "pending" },
              { label: "Decline", tone: "danger" as const, payload: { status: "declined" }, hidden: (order) => order.status !== "pending" },
              { label: "Assign", payload: { deliveryStatus: "assigned" }, hidden: (order) => order.status !== "accepted" || order.delivery_status !== "unassigned" },
              { label: "Send out", payload: { deliveryStatus: "out_for_delivery" }, hidden: (order) => order.delivery_status !== "assigned" },
              { label: "Complete", payload: { status: "completed", deliveryStatus: "delivered" }, hidden: (order) => order.status === "completed" || order.status === "cancelled" },
              { label: "Cancel", tone: "danger" as const, payload: { status: "cancelled" }, hidden: (order) => order.status === "completed" || order.status === "cancelled" },
            ]}
            onSaved={() => void refresh()}
          />
        </>
      )}
    </main>
  );
}
