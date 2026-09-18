"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessDashboardData,
  BusinessEntry,
  BusinessListing,
  BusinessDeliveryArea,
  BusinessSocialLink,
  BusinessReview,
  BusinessStaffRole,
  BusinessOrder,
} from "@/types";
import {
  businessFetch,
  createBusinessResource,
  deleteBusinessResource,
  updateBusinessProfile,
  updateBusinessResource,
  uploadBusinessImage,
} from "@/lib/business/api";
import styles from "./page.module.css";

const EMPTY: BusinessDashboardData = {
  profile: null, listings: [], delivery_areas: [], social_links: [], reviews: [], staff_roles: [], entries: [], orders: [],
};
const FALLBACK_IMAGE = "/business-item-fallback.svg";
const FALLBACK_BANNER = "/business-banner-fallback.svg";
const CHAT_URL = "/chat";

type ModalId = "entry" | "about" | "owner" | "hours" | "listings" | "delivery" | "social" | "reviews" | "header" | "banner" | "staff" | null;
type EntryTab = "item" | "service" | "vacancy";

type EntryDraft = { id?: string; entryType: EntryTab; title: string; description: string; price: string; imageUrl: string };
type ListingDraft = { id?: string; title: string; url: string; category: string; description: string };
type DeliveryDraft = { id?: string; area: string; city: string; state: string; postalCode: string };
type SocialDraft = { id?: string; platform: string; label: string; url: string };
type ReviewDraft = { id?: string; reviewerName: string; rating: number; title: string; body: string };
type StaffDraft = { id?: string; roleName: string; description: string; staffCount: string };

function asString(value: unknown) { return typeof value === "string" ? value : ""; }
function money(value: number | null | undefined) { return value == null ? "" : `₹${value}`; }
function formatDate(value: string) { try { return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return value; } }
function stars(rating: number) { return Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? "★" : "☆").join(""); }

export default function BusinessDashboard() {
  const router = useRouter();
  const [data, setData] = useState<BusinessDashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeEntryTab, setActiveEntryTab] = useState<EntryTab>("item");
  const [activeProfileTab, setActiveProfileTab] = useState<"home" | "staff">("home");
  const [profileOpen, setProfileOpen] = useState(true);
  const [detail, setDetail] = useState<BusinessEntry | null>(null);
  const [usersOpen, setUsersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalId>(null);
  const [editingEntry, setEditingEntry] = useState<BusinessEntry | null>(null);
  const [editingStaff, setEditingStaff] = useState<BusinessStaffRole | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>({ entryType: "item", title: "", description: "", price: "", imageUrl: "" });
  const [about, setAbout] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [weekday, setWeekday] = useState("");
  const [sunday, setSunday] = useState("");
  const [listings, setListings] = useState<ListingDraft[]>([]);
  const [delivery, setDelivery] = useState<DeliveryDraft[]>([]);
  const [social, setSocial] = useState<SocialDraft[]>([]);
  const [reviews, setReviews] = useState<ReviewDraft[]>([]);
  const [staff, setStaff] = useState<StaffDraft>({ roleName: "", description: "", staffCount: "1" });
  const [headerName, setHeaderName] = useState("");
  const [headerTagline, setHeaderTagline] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await businessFetch<BusinessDashboardData>("/api/business");
      setData(result);
      setError("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load business data";
      if (message.toLowerCase().includes("authentication")) router.replace("/auth?next=%2Fbusiness&mode=login");
      else setError(message);
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setModal(null); setDetail(null); setUsersOpen(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entries = useMemo(() => data.entries.filter((entry) => entry.active !== false), [data.entries]);
  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const matchesTab = entry.entry_type === activeEntryTab;
    const q = search.trim().toLowerCase();
    return matchesTab && (!q || `${entry.title} ${entry.description || ""}`.toLowerCase().includes(q));
  }), [entries, activeEntryTab, search]);
  const avgRating = data.profile?.rating_average ?? (data.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : 0);
  const pendingOrders = data.orders.filter((order) => order.status === "pending" || order.status === "accepted");
  const profile = data.profile;

  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2600); }
  function openEntry(entry?: BusinessEntry) {
    setEditingEntry(entry || null);
    setEntryDraft(entry ? { id: entry.id, entryType: entry.entry_type, title: entry.title, description: entry.description || "", price: entry.price == null ? "" : String(entry.price), imageUrl: entry.image_url || "" } : { entryType: activeEntryTab, title: "", description: "", price: "", imageUrl: "" });
    setModal("entry");
  }
  async function saveEntry(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { entryType: entryDraft.entryType, title: entryDraft.title, description: entryDraft.description || null, price: entryDraft.price ? Number(entryDraft.price) : null, imageUrl: entryDraft.imageUrl || null, active: true };
      if (editingEntry) await updateBusinessResource("entries", editingEntry.id, payload);
      else await createBusinessResource("entries", payload);
      setModal(null); await refresh(); showNotice("Entry saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save entry"); } finally { setSaving(false); }
  }
  async function removeEntry(entry: BusinessEntry) {
    if (!window.confirm(`Delete ${entry.title}?`)) return;
    try { await deleteBusinessResource("entries", entry.id); await refresh(); showNotice("Entry deleted"); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete entry"); }
  }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
    const file = event.target.files?.[0]; if (!file) return;
    setSaving(true); setError("");
    try { const result = await uploadBusinessImage(file); callback(result.url); } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed"); } finally { setSaving(false); }
  }
  function openProfileModal(kind: Exclude<ModalId, null>, selectedStaff: BusinessStaffRole | null = null) {
    if (kind === "about") setAbout(profile?.description || "");
    if (kind === "owner") { setOwnerName(profile?.owner_name || ""); setOwner(profile?.owner_bio || ""); }
    if (kind === "hours") { const h = profile?.working_hours || {}; setWeekday(h["Monday-Saturday"] || h["Monday – Saturday"] || "8:00 AM – 9:00 PM"); setSunday(h.Sunday || "9:00 AM – 2:00 PM"); }
    if (kind === "header") { setHeaderName(profile?.name || ""); setHeaderTagline(profile?.tagline || ""); }
    if (kind === "banner") setBannerUrl(profile?.banner_image_url || "");
    if (kind === "listings") setListings(data.listings.map((x) => ({ id: x.id, title: x.title, url: x.description || "", category: x.category || "", description: x.description || "" })));
    if (kind === "delivery") setDelivery(data.delivery_areas.map((x) => ({ id: x.id, area: x.area, city: x.city || "", state: x.state || "", postalCode: x.postal_code || "" })));
    if (kind === "social") setSocial(data.social_links.map((x) => ({ id: x.id, platform: x.platform, label: x.label || x.platform, url: x.url })));
    if (kind === "reviews") setReviews(data.reviews.map((x) => ({ id: x.id, reviewerName: x.reviewer_name, rating: x.rating, title: x.title || "", body: x.body })));
    if (kind === "staff") { setEditingStaff(selectedStaff); setStaff(selectedStaff ? { id: selectedStaff.id, roleName: selectedStaff.role_name, description: selectedStaff.description || "", staffCount: String(selectedStaff.staff_count) } : { roleName: "", description: "", staffCount: "1" }); }
    setModal(kind);
  }
  async function patchProfile(payload: Record<string, unknown>, message: string) {
    setSaving(true); setError(""); try { if (profile) await updateBusinessProfile(payload); else { if (typeof payload.name !== "string" || payload.name.trim().length < 2) throw new Error("Create your business first using Edit Business Header (name must be at least two characters)."); await businessFetch("/api/business", { method: "POST", body: JSON.stringify(payload) }); } setModal(null); await refresh(); showNotice(message); } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile"); } finally { setSaving(false); }
  }
  async function saveListings(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); try {
      const existing = new Set(data.listings.map((x) => x.id)); const kept = new Set<string>();
      for (const row of listings.filter((x) => x.title.trim())) {
        const payload = { title: row.title.trim(), description: row.description || null, category: row.category || null, active: true };
        if (row.id) { kept.add(row.id); await updateBusinessResource("listings", row.id, payload); } else await createBusinessResource("listings", payload);
      }
      for (const id of existing) if (!kept.has(id)) await deleteBusinessResource("listings", id);
      setModal(null); await refresh(); showNotice("Listings updated");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save listings"); } finally { setSaving(false); }
  }
  async function saveDelivery(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); try {
      const existing = new Set(data.delivery_areas.map((x) => x.id)); const kept = new Set<string>();
      for (const row of delivery.filter((x) => x.area.trim())) {
        const payload = { area: row.area.trim(), city: row.city || null, state: row.state || null, postalCode: row.postalCode || null, active: true };
        if (row.id) { kept.add(row.id); await updateBusinessResource("delivery-areas", row.id, payload); } else await createBusinessResource("delivery-areas", payload);
      }
      for (const id of existing) if (!kept.has(id)) await deleteBusinessResource("delivery-areas", id);
      setModal(null); await refresh(); showNotice("Delivery areas updated");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save delivery areas"); } finally { setSaving(false); }
  }
  async function saveSocial(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); try {
      const existing = new Set(data.social_links.map((x) => x.id)); const kept = new Set<string>();
      for (const row of social.filter((x) => x.platform.trim() && x.url.trim())) {
        const payload = { platform: row.platform.trim(), label: row.label.trim() || row.platform.trim(), url: row.url.trim(), active: true };
        if (row.id) { kept.add(row.id); await updateBusinessResource("social-links", row.id, payload); } else await createBusinessResource("social-links", payload);
      }
      for (const id of existing) if (!kept.has(id)) await deleteBusinessResource("social-links", id);
      setModal(null); await refresh(); showNotice("Social links updated");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save social links"); } finally { setSaving(false); }
  }
  async function saveReviews(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); try {
      const existing = new Set(data.reviews.map((x) => x.id)); const kept = new Set<string>();
      for (const row of reviews.filter((x) => x.reviewerName.trim() && x.body.trim())) {
        const payload = { reviewerName: row.reviewerName.trim(), rating: Number(row.rating), title: row.title || null, body: row.body.trim(), approved: true };
        if (row.id) { kept.add(row.id); await updateBusinessResource("reviews", row.id, payload); } else await createBusinessResource("reviews", payload);
      }
      for (const id of existing) if (!kept.has(id)) await deleteBusinessResource("reviews", id);
      setModal(null); await refresh(); showNotice("Reviews updated");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save reviews"); } finally { setSaving(false); }
  }
  async function saveStaff(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); try {
      const payload = { roleName: staff.roleName.trim(), description: staff.description.trim() || null, staffCount: staff.staffCount.trim() === "" ? 1 : Number(staff.staffCount), active: true };
      if (editingStaff) await updateBusinessResource("staff", editingStaff.id, payload); else await createBusinessResource("staff", payload);
      setModal(null); setEditingStaff(null); await refresh(); showNotice("Staff role saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save staff role"); } finally { setSaving(false); }
  }
  async function orderUpdate(order: BusinessOrder, payload: Record<string, unknown>, message: string) {
    try { await updateBusinessResource("orders", order.id, payload); await refresh(); showNotice(message); } catch (e) { setError(e instanceof Error ? e.message : "Could not update order"); }
  }

  if (loading) return <main className={styles.page}><div className={styles.loadingState}><span className={styles.logoMark}>H</span><p>Opening your business workspace...</p></div></main>;

  return <div className={styles.page}>
    <header className={styles.header}>
      <button className={styles.roundButton} onClick={() => setProfileOpen(true)} title="Open Profile"><i className="fa-solid fa-house" /></button>
      <div className={styles.search}><i className="fa-solid fa-magnifying-glass" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." /></div>
      <button className={styles.roundButton} onClick={() => openEntry()} title="Add New"><i className="fa-solid fa-plus" /></button>
    </header>

    <button className={`${styles.floatingButton} ${styles.leftFloat}`} onClick={() => router.push(CHAT_URL)} title="Open Messages"><i className="fa-solid fa-comment-dots" /></button>
    <button className={`${styles.floatingButton} ${styles.rightFloat}`} onClick={() => setUsersOpen(true)} title="Notifications"><i className="fa-solid fa-bell" /></button>

    {error && <div className={styles.toastError}>{error}</div>}
    {notice && <div className={styles.toastOk}>{notice}</div>}

    <main className={styles.main}>
      <div className={styles.grid}>
        {visibleEntries.map((entry) => <article key={entry.id} className={styles.itemCard} onClick={() => setDetail(entry)}>
          <button className={styles.editCard} onClick={(e) => { e.stopPropagation(); openEntry(entry); }}><i className="fa-solid fa-pen-to-square" /></button>
          <img src={entry.image_url || FALLBACK_IMAGE} alt={entry.title} />
          <strong>{entry.title}</strong>
          <span>{entry.entry_type === "item" ? (money(entry.price) || "Product") : entry.entry_type === "service" ? "Type of service" : (money(entry.price) || "Vacancy")}</span>
        </article>)}
        {!visibleEntries.length && <div className={styles.empty}>No {activeEntryTab}s found. Use <b>+</b> to add one.</div>}
      </div>
    </main>
    <footer className={styles.mainFooter}>
      {([['item','All Items','fa-border-all'],['service','Services','fa-gears'],['vacancy','Vacancies','fa-user-plus']] as const).map(([id,label,icon]) => <button key={id} className={activeEntryTab === id ? styles.footerActive : styles.footerButton} onClick={() => setActiveEntryTab(id)}><i className={`fa-solid ${icon}`} /><span>{label}</span></button>)}
    </footer>

    {profileOpen && <div className={styles.overlay}>
      <button className={styles.closeOverlay} onClick={() => setProfileOpen(false)}><i className="fa-solid fa-xmark" /></button>
      <div className={styles.profileBanner}><img src={profile?.banner_image_url || FALLBACK_BANNER} alt="Business banner" /><button aria-label="Edit Business Banner" onClick={() => openProfileModal("banner")}><i className="fa-solid fa-pen-to-square" /></button></div>
      <div className={styles.profileHeader}><button aria-label="Edit Business Header" onClick={() => openProfileModal("header")}><i className="fa-solid fa-pen-to-square" /></button><h1>{profile?.name || "BUSINESS NAME"}</h1><p>{profile?.tagline || '"BUSINESS TAGLINE"'}</p></div>
      <div className={styles.profileBody}>
        {activeProfileTab === "home" ? <>
          <section className={styles.infoCard}><Title icon="fa-box-open" text={`Order Received${pendingOrders.length ? ` (${pendingOrders.length})` : ""}`} />{pendingOrders.length ? pendingOrders.map((order) => <OrderCard key={order.id} order={order} onUpdate={orderUpdate} />) : <p className={styles.muted}>Upcoming Orders Will Be Displayed Here</p>}</section>
          <section className={styles.infoCard}><Title icon="fa-circle-info" text="About Business" edit={() => openProfileModal("about")} /><p className={styles.description}>{profile?.description || ""}</p></section>
          <section className={styles.infoCard}><Title icon="fa-user-tie" text="About Business Owner" edit={() => openProfileModal("owner")} /><p className={styles.description}>{profile?.owner_bio || ""}</p>{profile?.owner_name && <p className={styles.ownerName}>{profile.owner_name}</p>}</section>
          <section className={styles.infoCard}><Title icon="fa-clock" text="Working Hours" edit={() => openProfileModal("hours")} /><p className={styles.description}><b>Monday – Saturday:</b> {profile?.working_hours?.["Monday-Saturday"] || "8:00 AM – 9:00 PM"}<br /><b>Sunday:</b> {profile?.working_hours?.Sunday || "9:00 AM – 2:00 PM"}</p></section>
          <section className={styles.infoCard}><Title icon="fa-utensils" text="LISTINGS IN" edit={() => openProfileModal("listings")} /><div className={styles.linkGrid}>{data.listings.filter(x => x.active).map((x) => <a key={x.id} href={x.description || "#"} target="_blank" rel="noreferrer" className={`${styles.linkBox} ${styles.linkWeb}`}><i className="fa-solid fa-store" />{x.title}</a>)}</div>{!data.listings.length && <p className={styles.muted}>Add platforms where customers can find you.</p>}</section>
          <section className={styles.infoCard}><Title icon="fa-truck-fast" text="DELIVERY PLACES AVAILABLE" edit={() => openProfileModal("delivery")} /><div className={styles.tags}>{data.delivery_areas.filter(x => x.active).map((x) => <span key={x.id}><i className="fa-solid fa-location-dot" />{x.area}</span>)}</div></section>
          <section className={styles.infoCard}><Title icon="fa-link" text="SOCIAL MEDIA" edit={() => openProfileModal("social")} /><div className={styles.linkGrid}>{data.social_links.filter(x => x.active).map((x) => <a key={x.id} href={x.url} target="_blank" rel="noreferrer" className={`${styles.linkBox} ${socialClass(x.platform)}`}><i className={socialIcon(x.platform)} />{x.label || x.platform}</a>)}</div></section>
          <section className={styles.infoCard}><Title icon="fa-star" text="REVIEWS & RATINGS" edit={() => openProfileModal("reviews")} /><div className={styles.ratingRow}><strong>{avgRating ? avgRating.toFixed(1) : "—"}</strong><div><div className={styles.stars}>{stars(avgRating)}</div><small>Based on {profile?.review_count ?? data.reviews.length} verified reviews</small></div></div>{data.reviews.map((review) => <div key={review.id} className={styles.review}><div><b>{review.reviewer_name}</b><small>{formatDate(review.created_at)}</small></div><div className={styles.stars}>{stars(review.rating)}</div><p>{review.body}</p></div>)}</section>
        </> : <section className={styles.infoCard}><Title icon="fa-users-gear" text="Existing Jobs" edit={() => { setEditingStaff(null); openProfileModal("staff"); }} /><div>{data.staff_roles.filter(x => x.active).map((role) => <div className={styles.staffRow} key={role.id}><div className={styles.avatar}>{role.role_name.charAt(0).toUpperCase()}</div><div className={styles.staffInfo}><b>{role.role_name}</b><span>{role.description || ""}</span></div><div className={styles.staffActions}><span className={styles.count}><i className="fa-solid fa-users" />{role.staff_count}</span><button onClick={() => { openProfileModal("staff", role); }}><i className="fa-solid fa-pen" /></button><button onClick={async () => { if (window.confirm("Remove this staff role?")) { await deleteBusinessResource("staff", role.id); await refresh(); } }}><i className="fa-solid fa-trash" /></button></div></div>)}</div></section>}
      </div>
      <footer className={styles.footer}><button className={activeProfileTab === "home" ? styles.footerActive : styles.footerButton} onClick={() => setActiveProfileTab("home")}><i className="fa-solid fa-house" aria-hidden="true" /><span>Home</span></button><button className={activeProfileTab === "staff" ? styles.footerActive : styles.footerButton} onClick={() => setActiveProfileTab("staff")}><i className="fa-solid fa-id-badge" aria-hidden="true" /><span>Staff</span></button><button className={styles.footerButton} onClick={() => setProfileOpen(false)}><i className="fa-solid fa-border-all" aria-hidden="true" /><span>Info</span></button></footer>
    </div>}

    {detail && <div className={styles.overlay}><button className={styles.closeOverlay} onClick={() => setDetail(null)}><i className="fa-solid fa-xmark" /></button><div className={styles.detailHeader}><h1>{detail.title}</h1><p>{detail.entry_type}</p></div><div className={styles.profileBody}>{detail.image_url && <img className={styles.detailImage} src={detail.image_url} alt={detail.title} />}<section className={styles.infoCard}><Title icon="fa-circle-info" text="Information & Description" /><p className={styles.description}>{detail.description || "No details specified."}</p></section><section className={styles.infoCard}><Title icon="fa-handshake" text="Direct Actions" /><a className={`${styles.actionButton} ${styles.whatsapp}`} href={`https://wa.me/${profile?.phone?.replace(/\D/g, "") || ""}`} target="_blank" rel="noreferrer"><i className="fa-brands fa-whatsapp" />Contact / Inquire</a>{profile?.phone && <a className={`${styles.actionButton} ${styles.call}`} href={`tel:${profile.phone}`}><i className="fa-solid fa-phone" />Call Business Now</a>}</section></div></div>}

    {usersOpen && <div className={styles.usersOverlay}><div className={styles.usersPage}><button className={styles.closeUsers} onClick={() => setUsersOpen(false)}><i className="fa-solid fa-xmark" /></button><header className={styles.usersHeader}><div className={styles.usersSearch}><i className="fa-solid fa-magnifying-glass" /><input value={usersSearch} onChange={(e) => setUsersSearch(e.target.value.toLowerCase())} placeholder="SEARCH USERS..." /></div><button onClick={() => setUsersSearch("")}><i className="fa-solid fa-rotate-right" /></button></header><div className={styles.usersList}><p role="status">User-request notifications are not connected yet. Open Messages to view your conversations.</p></div></div></div>}

    <Modal open={modal === "entry"} title={editingEntry ? "Edit Item Details" : `Add New ${activeEntryTab === "item" ? "Item" : activeEntryTab === "service" ? "Service" : "Vacancy"}`} close={() => setModal(null)}>
      <form onSubmit={saveEntry}><Select label="Type" value={entryDraft.entryType} onChange={(v) => setEntryDraft(x => ({ ...x, entryType: v as EntryTab }))} options={["item","service","vacancy"]} /><Field label="Title" value={entryDraft.title} onChange={(v) => setEntryDraft(x => ({ ...x, title: v }))} required /><Field label="Price / Salary" value={entryDraft.price} onChange={(v) => setEntryDraft(x => ({ ...x, price: v }))} /><TextArea label="Description" value={entryDraft.description} onChange={(v) => setEntryDraft(x => ({ ...x, description: v }))} /><Field label="Image URL (optional)" value={entryDraft.imageUrl} onChange={(v) => setEntryDraft(x => ({ ...x, imageUrl: v }))} /><FileField onUpload={(url) => setEntryDraft(x => ({ ...x, imageUrl: url }))} onBusy={setSaving} /><Actions saving={saving} onCancel={() => setModal(null)} /></form>
    </Modal>
    <Modal open={modal === "about"} title="Edit About Business" close={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); void patchProfile({ description: about }, "About updated"); }}><TextArea label="Business Description" value={about} onChange={setAbout} rows={7} /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "owner"} title="Edit Business Owner" close={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); void patchProfile({ ownerName, ownerBio: owner }, "Owner information updated"); }}><Field label="Owner Name" value={ownerName} onChange={setOwnerName} /><TextArea label="Owner Information" value={owner} onChange={setOwner} rows={6} /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "hours"} title="Edit Working Hours" close={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); void patchProfile({ workingHours: { "Monday-Saturday": weekday, Sunday: sunday } }, "Working hours updated"); }}><Field label="Monday – Saturday" value={weekday} onChange={setWeekday} /><Field label="Sunday" value={sunday} onChange={setSunday} /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "header"} title="Edit Business Header" close={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); void patchProfile({ name: headerName, tagline: headerTagline }, "Business header updated"); }}><Field label="Business Name" value={headerName} onChange={setHeaderName} required /><Field label="Tagline" value={headerTagline} onChange={setHeaderTagline} /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "banner"} title="Update Profile Banner Image" close={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); void patchProfile({ bannerImageUrl: bannerUrl }, "Banner updated"); }}><Field label="Image URL" value={bannerUrl} onChange={setBannerUrl} /><FileField onUpload={setBannerUrl} onBusy={setSaving} /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "listings"} title="Add / Drop Listings" close={() => setModal(null)}><form onSubmit={saveListings}><div className={styles.dynamicList}>{listings.map((row, i) => <div className={styles.dynamicRow} key={row.id || i}><Field label="Platform" value={row.title} onChange={(v) => setListings(xs => xs.map((x,j) => j===i ? {...x,title:v}:x))} /><Field label="URL" value={row.description} onChange={(v) => setListings(xs => xs.map((x,j) => j===i ? {...x,description:v}:x))} /><button type="button" className={styles.removeButton} onClick={() => setListings(xs => xs.filter((_,j) => j!==i))}><i className="fa-solid fa-trash" /></button></div>)}</div><button type="button" className={styles.addList} onClick={() => setListings(xs => [...xs,{title:"",url:"",category:"",description:""}])}><i className="fa-solid fa-plus" /> Add Listing</button><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "delivery"} title="Edit Delivery Places" close={() => setModal(null)}><form onSubmit={saveDelivery}><div className={styles.dynamicList}>{delivery.map((row, i) => <div className={styles.dynamicRow} key={row.id || i}><Field label="Area / Location" value={row.area} onChange={(v) => setDelivery(xs => xs.map((x,j) => j===i ? {...x,area:v}:x))} /><button type="button" className={styles.removeButton} onClick={() => setDelivery(xs => xs.filter((_,j) => j!==i))}><i className="fa-solid fa-trash" /></button></div>)}</div><button type="button" className={styles.addList} onClick={() => setDelivery(xs => [...xs,{area:"",city:"",state:"",postalCode:""}])}><i className="fa-solid fa-plus" /> Add Delivery Area</button><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "social"} title="Edit Social Media" close={() => setModal(null)}><form onSubmit={saveSocial}><div className={styles.dynamicList}>{social.map((row, i) => <div className={styles.dynamicRow} key={row.id || i}><Field label="Platform" value={row.platform} onChange={(v) => setSocial(xs => xs.map((x,j) => j===i ? {...x,platform:v}:x))} /><Field label="Label" value={row.label} onChange={(v) => setSocial(xs => xs.map((x,j) => j===i ? {...x,label:v}:x))} /><Field label="URL" value={row.url} onChange={(v) => setSocial(xs => xs.map((x,j) => j===i ? {...x,url:v}:x))} /><button type="button" className={styles.removeButton} onClick={() => setSocial(xs => xs.filter((_,j) => j!==i))}><i className="fa-solid fa-trash" /></button></div>)}</div><button type="button" className={styles.addList} onClick={() => setSocial(xs => [...xs,{platform:"",label:"",url:""}])}><i className="fa-solid fa-plus" /> Add Social Link</button><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "reviews"} title="Edit Reviews & Ratings" close={() => setModal(null)}><form onSubmit={saveReviews}><div className={styles.dynamicList}>{reviews.map((row, i) => <div className={styles.reviewEditor} key={row.id || i}><Field label="Customer name" value={row.reviewerName} onChange={(v) => setReviews(xs => xs.map((x,j) => j===i ? {...x,reviewerName:v}:x))} /><Field label="Rating 1–5" value={String(row.rating)} onChange={(v) => setReviews(xs => xs.map((x,j) => j===i ? {...x,rating:Number(v)||1}:x))} type="number" /><TextArea label="Review" value={row.body} onChange={(v) => setReviews(xs => xs.map((x,j) => j===i ? {...x,body:v}:x))} /><button type="button" className={styles.removeButtonWide} onClick={() => setReviews(xs => xs.filter((_,j) => j!==i))}><i className="fa-solid fa-trash" /> Remove Review</button></div>)}</div><button type="button" className={styles.addList} onClick={() => setReviews(xs => [...xs,{reviewerName:"",rating:5,title:"",body:""}])}><i className="fa-solid fa-plus" /> Add Review</button><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
    <Modal open={modal === "staff"} title={editingStaff ? "Edit Staff Job Role" : "Add Staff Job Role"} close={() => { setModal(null); setEditingStaff(null); }}><form onSubmit={saveStaff}><Field label="Role Name" value={staff.roleName} onChange={(v) => setStaff(x => ({...x,roleName:v}))} required /><Field label="Job Description / Responsibilities" value={staff.description} onChange={(v) => setStaff(x => ({...x,description:v}))} /><Field label="Number of Employees" value={staff.staffCount} onChange={(v) => setStaff(x => ({...x,staffCount:v}))} type="number" /><Actions saving={saving} onCancel={() => setModal(null)} /></form></Modal>
  </div>;
}

function Title({ icon, text, edit }: { icon: string; text: string; edit?: () => void }) { return <div className={styles.cardTitle}><span><i className={`fa-solid ${icon}`} />{text}</span>{edit && <button aria-label={`Edit ${text}`} onClick={edit}><i className="fa-solid fa-pen" /></button>}</div>; }
function Modal({ open, title, close, children }: { open: boolean; title: string; close: () => void; children: React.ReactNode }) { if (!open) return null; return <div className={styles.modalOverlay} onMouseDown={(e) => { if (e.currentTarget === e.target) close(); }}><div className={styles.modal} role="dialog" aria-modal="true" aria-label={title}><div className={styles.modalTop}><h2>{title}</h2><button onClick={close}><i className="fa-solid fa-xmark" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, type="text", required=false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className={styles.formGroup}><span>{label}</span><input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function TextArea({ label, value, onChange, rows=4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className={styles.formGroup}><span>{label}</span><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className={styles.formGroup}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>; }
function FileField({ onUpload, onBusy }: { onUpload: (url: string) => void; onBusy: (busy: boolean) => void }) { const [busy, setBusy] = useState(false); const [error, setError] = useState(""); return <label className={styles.formGroup}><span>Upload Image</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={async (e) => { const file=e.target.files?.[0]; e.target.value=""; if(!file)return; setBusy(true); onBusy(true); setError(""); try { const result=await uploadBusinessImage(file); onUpload(result.url); } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed"); } finally { setBusy(false); onBusy(false); } }} /><small>{busy ? "Uploading…" : "Maximum 5 MB"}</small>{error && <span role="alert">{error}</span>}</label>; }
function Actions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) { return <div className={styles.modalActions}><button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button><button type="submit" className={styles.submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button></div>; }
function OrderCard({ order, onUpdate }: { order: BusinessOrder; onUpdate: (order: BusinessOrder, payload: Record<string, unknown>, message: string) => Promise<void> }) { const [deliveryBoy, setDeliveryBoy] = useState(order.delivery_boy_name || ""); const items = order.items.map((item) => `${asString(item.title)} × ${item.quantity ?? 1}`).join(", "); return <div className={styles.orderBox}><div className={styles.orderInfo}><span><i className="fa-solid fa-receipt" /> Order #{order.id.slice(0, 8)}</span><b>{order.status}</b></div><p><strong>Customer:</strong> {order.customer_name}<br /><strong>Items:</strong> {items || "Order items"}<br /><strong>Amount:</strong> ₹{order.total_amount}<br /><strong>Delivery Address:</strong> {order.address}</p>{order.status === "pending" && <div className={styles.orderActions}><button className={styles.accept} onClick={() => void onUpdate(order,{status:"accepted"},"Order accepted successfully")}>✓ Accept</button><button className={styles.decline} onClick={() => void onUpdate(order,{status:"declined"},"Order declined")}>✕ Decline</button></div>}{order.status === "accepted" && <div className={styles.deliveryBox}><label>Delivery Boy Available?</label><select value={deliveryBoy ? "yes" : ""} onChange={(e) => { if(e.target.value==="yes") { setDeliveryBoy("Available delivery boy"); void onUpdate(order,{deliveryStatus:"assigned",deliveryBoyName:"Available delivery boy"},"Delivery boy assigned"); } else setDeliveryBoy(""); }}><option value="">-- Select Availability --</option><option value="yes">Yes – Delivery Boy Available</option><option value="no">No – Delivery Boy Not Available</option></select>{!deliveryBoy && <button onClick={() => { setDeliveryBoy("Nearer delivery boy"); void onUpdate(order,{deliveryStatus:"assigned",deliveryBoyName:"Nearer delivery boy"},"Connected with nearer delivery boy"); }}>Connect with Nearer Delivery Boy</button>}</div>}</div>; }
function socialClass(platform: string) { const p=platform.toLowerCase(); if(p.includes("instagram"))return styles.insta; if(p.includes("facebook"))return styles.facebook; if(p.includes("linkedin"))return styles.linkedin; if(p.includes("youtube"))return styles.youtube; if(p.includes("whatsapp"))return styles.whatsappLink; if(p.includes("telegram"))return styles.telegram; if(p.includes("twitter")||p.includes("x"))return styles.twitter; if(p.includes("mail"))return styles.mail; if(p.includes("map"))return styles.maps; if(p.includes("call")||p.includes("phone"))return styles.callLink; return styles.web; }
function socialIcon(platform: string) { const p=platform.toLowerCase(); if(p.includes("instagram"))return "fa-brands fa-instagram"; if(p.includes("facebook"))return "fa-brands fa-facebook-f"; if(p.includes("linkedin"))return "fa-brands fa-linkedin-in"; if(p.includes("youtube"))return "fa-brands fa-youtube"; if(p.includes("whatsapp"))return "fa-brands fa-whatsapp"; if(p.includes("telegram"))return "fa-brands fa-telegram"; if(p.includes("twitter")||p === "x")return "fa-brands fa-twitter"; if(p.includes("mail"))return "fa-solid fa-envelope"; if(p.includes("map"))return "fa-solid fa-location-dot"; if(p.includes("call")||p.includes("phone"))return "fa-solid fa-phone"; return "fa-solid fa-link"; }
