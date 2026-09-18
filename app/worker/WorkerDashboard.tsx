"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { professions } from "./professions";
import { cx, Section, UploadZone, WorkerModal } from "./WorkerControls";
import { emptyProfile, safeLink, uploadWorkerFile, workerFetch, type WorkerProfile } from "./worker-api";

type Editor = "profile" | "about" | "description" | "featured" | "social" | "skill" | null;
const fields = [ ["name", "Name", 120], ["phone", "Phone", 40], ["email", "Email", 254], ["location", "Address", 500], ["qualification", "Qualification", 200], ["experience", "Years of experience", 80] ] as const;

export default function WorkerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState<WorkerProfile>(emptyProfile);
  const [text, setText] = useState("");
  const [paragraph, setParagraph] = useState("");
  const [panel, setPanel] = useState<"status" | "jobs" | null>(null);
  const [statusTab, setStatusTab] = useState("work");
  const [jobTab, setJobTab] = useState("all");
  const [past, setPast] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await workerFetch<{ profile: WorkerProfile | null }>("/api/worker/profile", { cache: "no-store" });
      setProfile(data.profile ? { ...emptyProfile, ...data.profile } : emptyProfile);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load profile"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function patch(payload: Record<string, unknown>) {
    const data = await workerFetch<{ profile: WorkerProfile }>("/api/worker/profile", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!data.profile) throw new Error("The server did not return a saved profile.");
    setProfile({ ...emptyProfile, ...data.profile });
  }
  async function perform(action: () => Promise<void>, message = "Changes saved") {
    if (lock.current || loading) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); setNotice(message); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save changes"); }
    finally { lock.current = false; setBusy(false); }
  }
  function openEditor(id: Exclude<Editor, null>) {
    setDraft({ ...profile, social_links: profile.social_links.map(link => ({ ...link })) });
    setText(id === "about" ? profile.about_text : id === "description" ? profile.work_description : id === "featured" ? profile.featured.join("\n") : "");
    setEditor(id);
  }
  function saveEditor(e: FormEvent) {
    e.preventDefault();
    void perform(async () => {
      let payload: Record<string, unknown> = {};
      if (editor === "profile") payload = Object.fromEntries(fields.map(([key]) => [key, key === "email" ? draft.email?.trim() || null : draft[key]]));
      if (editor === "about") payload = { aboutText: text };
      if (editor === "description") payload = { workDescription: text };
      if (editor === "featured") payload = { featured: text.split("\n").map(s => s.trim()).filter(Boolean) };
      if (editor === "skill") {
        const skill = text.trim();
        if (!skill) throw new Error("Enter a skill or service.");
        if (profile.skills.some(s => s.toLowerCase() === skill.toLowerCase())) throw new Error("That skill is already listed.");
        payload = { skills: [...profile.skills, skill] };
      }
      if (editor === "social") {
        if (draft.social_links.some(link => !link.label.trim() || !safeLink(link.url))) throw new Error("Each link needs a label and a valid http:// or https:// URL.");
        payload = { socialLinks: draft.social_links };
      }
      await patch(payload); setEditor(null);
    });
  }
  function upload(files: File[], target: "profileImageUrl" | "backgroundImageUrl" | "resumeUrl" | "works") {
    if (!files.length) return;
    void perform(async () => {
      if (target === "works" && profile.works.length + files.length > 200) throw new Error("A maximum of 200 work samples is supported.");
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadWorkerFile(file, target === "resumeUrl"));
      await patch(target === "works" ? { works: [...profile.works, ...urls.map(content => ({ type: "image", content }))] } : { [target]: urls[0] });
    }, "Upload saved");
  }
  const disabled = busy || loading;
  return <main className={cx("page")}>
    {loading && <p role="status">Loading worker profile…</p>}
    {error && !editor && <div role="alert">{error} <button type="button" onClick={() => void load()} disabled={busy}>Reload</button> <Link href="/chat">Open chat / establish session</Link></div>}
    <div className={cx("reference-header")}>
      <div className={cx("cover-container")} style={safeLink(profile.background_image_url || "") ? { backgroundImage: `url(${JSON.stringify(profile.background_image_url)})` } : undefined}>
        <button className={cx("header-back")} type="button" onClick={() => router.push("/chat")} aria-label="Back to chat">←</button>
        <div className={cx("header-image-actions")}>
          {([ ["profileImageUrl", "🖼️ Profile"], ["backgroundImageUrl", "🌄 Cover"] ] as const).map(([target, label]) => <label key={target} className={cx("header-image-btn")}>{label}<input type="file" aria-label={label} disabled={disabled} accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { upload(Array.from(e.target.files || []), target); e.target.value = ""; }} /></label>)}
          <button className={cx("header-ellipse-btn")} type="button" onClick={() => setPanel("status")} aria-label="Open work status">⋮</button>
        </div>
      </div>
      <div className={cx("profile-body-section")}>
        <div className={cx("portrait-wrapper")}>
          {safeLink(profile.profile_image_url || "") ? <img className={cx("header-portrait")} src={profile.profile_image_url!} alt={profile.name || "Worker portrait"} /> : <div className={cx("header-portrait")} role="img" aria-label="No profile photo">👤</div>}
          <button className={cx("edit-button")} type="button" onClick={() => openEditor("profile")} disabled={disabled} aria-label="Edit profile">✎</button>
        </div>
        <div className={cx("header-details")}>
          <div className={cx("name-row")}><h1 className={cx("worker-name")}>{profile.name || "NAME"}</h1></div>
          <div className={cx("profession")}><span className={cx("profession-icon")}>{professions.find(p => p.value === profile.profession)?.label.split(" ")[0] || "🛠️"}</span>
            <select className={cx("job-description-select")} aria-label="Profession" value={profile.profession} disabled={disabled} onChange={e => { const profession = e.target.value; void perform(() => patch({ profession })); }}>
              {!professions.some(p => p.value === profile.profession) && <option value={profile.profession}>{profile.profession}</option>}
              {professions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className={cx("contact-row")}><div className={cx("contact-item")}>📞 {profile.phone || "+91 Phone Number"}</div></div>
          <div className={cx("location-row")}>📍 {profile.location || "Address"}</div>
          <div className={cx("location-row")}>🎓 {profile.qualification || "Qualification"}</div>
          <div className={cx("location-row")}>🗓️ {profile.experience || "Years Of Experience"}</div>
          <div className={cx("bottom-row")}><span className={cx("rating")}>★ {profile.rating || "No ratings"}</span></div>
        </div>
      </div>
    </div>
    <Section title="👋 About Yourself" edit={() => openEditor("about")}><p className={cx("section-text")}>{profile.about_text || ""}</p></Section>
    <Section title="✍🏻 Describe the work" edit={() => openEditor("description")}><p className={cx("section-text")}>{profile.work_description || ""}</p></Section>
    <Section title="📄 Resume">
      <UploadZone label="Upload your resume (PDF or image)" pdf disabled={disabled} upload={files => upload(files, "resumeUrl")} />
      {safeLink(profile.resume_url || "") && <div className={cx("resume-image-container")}>
        <a href={profile.resume_url!} target="_blank" rel="noreferrer">Open / download resume</a>
        {!/\.pdf(?:[?#]|$)/i.test(profile.resume_url!) && <img className={cx("resume-preview")} src={profile.resume_url!} alt="Resume" />}
        <button type="button" disabled={disabled} onClick={() => void perform(() => patch({ resumeUrl: null }))}>❌ Remove resume</button>
      </div>}
    </Section>
    <Section title="🖼️ Post & Upload Your Works">
      <form onSubmit={e => { e.preventDefault(); if (paragraph.trim()) void perform(async () => { await patch({ works: [...profile.works, { type: "paragraph", content: paragraph.trim() }] }); setParagraph(""); }); }}>
        
        <textarea id="workParagraph" className={cx("form-input")} rows={3} maxLength={10000} value={paragraph} onChange={e => setParagraph(e.target.value)} />
        <button className={cx("modal-btn", "save")} disabled={disabled || !paragraph.trim()}>+ Add Paragraph</button>
      </form>
      <UploadZone label="Upload your work photos" multiple disabled={disabled} upload={files => upload(files, "works")} />
      <div className={cx("upload-preview-grid")}>
        {profile.works.map((item, index) => <div key={index} className={cx(item.type === "image" ? "upload-preview-card" : "paragraph-preview-card")}>
          <button type="button" className={cx("upload-delete-button")} aria-label={`Delete work ${index + 1}`} disabled={disabled} onClick={() => void perform(() => patch({ works: profile.works.filter((_, i) => i !== index) }))}>×</button>
          {item.type === "image" && safeLink(item.content) ? <img src={item.content} alt={`Work sample ${index + 1}`} /> : <p>{item.type === "image" ? "Image unavailable" : item.content}</p>}
        </div>)}
        {!profile.works.length && <p className={cx("upload-empty")}>Upload all your previous works till to date</p>}
      </div>
    </Section>
    <Section title="🛠️ My Skills & Services" edit={() => openEditor("skill")}>
      <div className={cx("skills-list")}>{profile.skills.map((skill, index) => <span className={cx("skill-pill")} key={index}>{skill}<button type="button" disabled={disabled} aria-label={`Remove ${skill}`} onClick={() => void perform(() => patch({ skills: profile.skills.filter((_, i) => i !== index) }))}>×</button></span>)}</div>
      <button type="button" className={cx("add-skill-button")} disabled={disabled} onClick={() => openEditor("skill")}>＋ Add</button>
    </Section>
    <Section title="🏆 Featured At" edit={() => openEditor("featured")}><div className={cx("featured-list")}>{profile.featured.length ? profile.featured.map((item, i) => <span key={i} className={cx("featured-chip")}>{item}</span>) : "➕ Add badges."}</div></Section>
    <Section title="📁 My Documents"><div className={cx("documents-grid")}>{["Official Enrollment Letter", "Worker ID Card"].map(title => <div key={title} className={cx("doc-card")}><h3 className={cx("doc-title")}>{title}</h3><p className={cx("doc-status")}>Not yet issued</p><button type="button" className={cx("btn-doc-view", "dark")} onClick={() => setNotice(`${title} is not yet issued. Contact admin in chat.`)}>View {title === "Worker ID Card" ? "ID" : "Letter"}</button></div>)}</div></Section>
    <Section title="🌐 Social Media & Links" edit={() => openEditor("social")}><div className={cx("social-links")}>{profile.social_links.map((link, index) => safeLink(link.url) ? <a key={index} className={cx("social-link")} href={safeLink(link.url)} target="_blank" rel="noreferrer">🔗 {link.label}</a> : <span key={index}>{link.label} (invalid link)</span>)}{!profile.social_links.length && ""}</div></Section>
    <button type="button" className={cx("floating-bell-btn")} aria-label="Notifications and job requests" onClick={() => setPanel("jobs")}><i className="fa-solid fa-bell" aria-hidden="true" /></button>
    <div className={cx("message-area")}><div className={cx("message-inner")}><button type="button" className={cx("user-button")} aria-label="Edit worker profile">🎓</button><Link className={cx("message-box")} href="/chat">Message here..Convey me</Link></div></div>
    {notice && <div role="status" className={cx("message-status", "show")}>{notice}</div>}
    {panel && <div className={cx(panel === "status" ? "work-status-card" : "jobs-card-container", "page-mode")}>
      <div className={cx("work-status-page-header")}><h2>{panel === "status" ? "Status" : "Available Job Requests"}</h2><button type="button" className={cx("work-status-close-btn")} onClick={() => setPanel(null)}>← Back</button></div>
      {error && <p role="alert">{error}</p>}
      {panel === "status" ? <>
        <div className={cx("status-tab-header")}>{["work", "payment"].map(tab => <button type="button" key={tab} className={cx("status-main-tab", statusTab === tab ? "active" : "")} aria-pressed={statusTab === tab} onClick={() => setStatusTab(tab)}>{tab === "work" ? "🟢 Work Status" : "💳 Payment Status"}</button>)}</div>
        {statusTab === "work" ? <><div className={cx("status-top-row")}><h3>Duty Availability</h3><label className={cx("toggle-switch")}><input type="checkbox" aria-label="Duty availability" checked={profile.work_available} disabled={disabled} onChange={e => { const workAvailable = e.target.checked; void perform(() => patch({ workAvailable })); }} /><span className={cx("toggle-slider")} /></label></div>
          <div className={cx("status-meta-row")}><span className={cx("status-pill", profile.work_available ? "" : "offline")}>{profile.work_available ? "AVAILABLE FOR WORK" : "OFFLINE"}</span><span>{profile.work_available ? "Receiving requests" : "Paused requests"}</span></div>
          <div className={cx("stats-grid")}>{[["TODAY", "₹ _______"], ["TODAY COMPLETION", "_______ works per day"], ["COMPLETED", String(profile.jobs_done)]].map(([label, value]) => <div className={cx("stat-box")} key={label}><h3 className={cx("stat-label")}>{label}</h3><p className={cx("stat-value")}>{value}</p></div>)}</div>
          <button type="button" className={cx("btn-dropdown-toggle")} aria-expanded={past} onClick={() => setPast(!past)}>📋 Past Activities {past ? "▲" : "▼"}</button>
          {past && <div className={cx("past-works-list")}>No past activity</div>}
        </> : <div className={cx("payment-grid")}><p>Payment history and balances are not available. No payment service is connected to this profile.</p><Link href="/chat">Contact support</Link></div>}
      </> : <><div className={cx("job-tabs")}>{[["all", "All"], ["urgent", "🚨 Most Urgent"], ["normal", "⚡ Normal Requests"]].map(([tab, label]) => <button type="button" key={tab} className={cx("tab-btn", jobTab === tab ? "active" : "")} aria-pressed={jobTab === tab} onClick={() => setJobTab(tab)}>{label} (0)</button>)}</div><div className={cx("no-jobs-message")}><h3 className={cx("no-jobs-title")}>No Relevant Job Requests</h3><p>No {jobTab === "all" ? "" : jobTab} requests are available for this profession. Job-request data is not connected yet.</p></div></>}
    </div>}
    {editor && <WorkerModal title={editor === "profile" ? "Edit Profile" : editor === "skill" ? "Add Skill / Service" : `Edit ${editor}`} close={() => { if (!busy) setEditor(null); }}>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={saveEditor}>
        {editor === "profile" ? fields.map(([key, label, limit]) => <label className={cx("form-group")} key={key}><span className={cx("form-label")}>{label}</span><input className={cx("form-input")} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} maxLength={limit} required={key === "name"} value={draft[key] || ""} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>) : editor === "social" ? <>
          {draft.social_links.map((link, index) => <div key={index} className={cx("form-group")}><label>Label<input className={cx("form-input")} required maxLength={200} value={link.label} onChange={e => setDraft({ ...draft, social_links: draft.social_links.map((l, i) => i === index ? { ...l, label: e.target.value } : l) })} /></label><label>URL<input className={cx("form-input")} required type="url" maxLength={2000} value={link.url} onChange={e => setDraft({ ...draft, social_links: draft.social_links.map((l, i) => i === index ? { ...l, url: e.target.value } : l) })} /></label><button type="button" onClick={() => setDraft({ ...draft, social_links: draft.social_links.filter((_, i) => i !== index) })}>❌ Remove link</button></div>)}
          <button type="button" disabled={draft.social_links.length >= 100} onClick={() => setDraft({ ...draft, social_links: [...draft.social_links, { label: "", url: "" }] })}>➕ Add link</button>
        </> : <label className={cx("form-group")}><span className={cx("form-label")}>{editor === "featured" ? "One featured badge per line" : editor === "skill" ? "Skill / service" : "Description"}</span><textarea className={cx("form-input")} rows={5} maxLength={editor === "skill" ? 200 : 10000} required={editor === "skill"} value={text} onChange={e => setText(e.target.value)} /></label>}
        <div className={cx("modal-actions")}><button className={cx("modal-btn", "cancel")} type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className={cx("modal-btn", "save")} disabled={disabled}>{busy ? "Saving…" : "Save Changes"}</button></div>
      </form>
    </WorkerModal>}
  </main>;
}

