"use client";

// Workers management panel.
//
// Lists the real rows of `public.worker_profiles`, with search, filters,
// sorting and pagination. Selecting a worker opens their full profile and
// allows the editable fields to be saved back to the database through the
// admin server actions.

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import {
  listWorkersAction,
} from "./actions";
import type { WorkerProfileRecord } from "@/types";
import { WorkerDetails } from "./worker-details";
import { professions } from "@/app/worker/professions";

const PER_PAGE = 15;

type SortKey = "created_at" | "name" | "email" | "profession" | "location" | "rating" | "jobs_done";
type Availability = "all" | "available" | "unavailable";

// The profession filter reuses the canonical profession list from the
// worker registration form (app/worker/professions.ts).
const PROFESSION_OPTIONS = professions
  .map((p) => p.value)
  .filter((value) => value && value !== "Select");

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function WorkersPanel() {
  const [workers, setWorkers] = useState<WorkerProfileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [profession, setProfession] = useState("");
  const [availability, setAvailability] = useState<Availability>("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWorkersAction({
        search: search.trim() || undefined,
        profession: profession || undefined,
        availability,
        sort,
        order,
        page,
        perPage: PER_PAGE,
      });
      setWorkers(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workers");
    } finally {
      setLoading(false);
    }
  }, [search, profession, availability, sort, order, page]);

  // Debounce the search box so we don't hammer the database on every key.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Any filter change resets to the first page.
  useEffect(() => { setPage(1); }, [search, profession, availability, sort, order]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder("asc");
    }
  };

  if (selectedId) {
    return (
      <WorkerDetails
        workerId={selectedId}
        onBack={() => { setSelectedId(null); void load(); }}
        onSaved={(updated) => {
          setWorkers((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        }}
      />
    );
  }

  return (
    <div className={styles.contentInner}>
      <div>
        <h2 className={styles.sectionTitle}>Workers</h2>
        <p className={styles.sectionHint}>
          {loading ? "Loading workers…" : `${total} registered worker${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by name, email, phone, profession or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search workers"
        />
        <select
          className={styles.selectInput}
          value={profession}
          onChange={(e) => setProfession(e.target.value)}
          aria-label="Filter by profession"
        >
          <option className={styles.selectOption} value="">All professions</option>
          {PROFESSION_OPTIONS.map((p) => (
            <option className={styles.selectOption} key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className={styles.selectInput}
          value={availability}
          onChange={(e) => setAvailability(e.target.value as Availability)}
          aria-label="Filter by availability"
        >
          <option className={styles.selectOption} value="all">Any availability</option>
          <option className={styles.selectOption} value="available">Available</option>
          <option className={styles.selectOption} value="unavailable">Unavailable</option>
        </select>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => toggleSort("created_at")}
        >
          {sort === "created_at" ? `Registered ${order === "asc" ? "↑" : "↓"}` : "Registered"}
        </button>
        <button type="button" className={styles.sortButton} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </p>
      )}

      {loading && workers.length === 0 ? (
        <div className={styles.stateBox}>
          <span className={styles.spinner} aria-hidden="true" />
          Loading workers…
        </div>
      ) : workers.length === 0 ? (
        <div className={styles.stateBox}>
          {search || profession || availability !== "all"
            ? "No workers match the current search or filters."
            : "No workers have registered yet."}
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("name")}>
                        Name {sort === "name" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("profession")}>
                        Profession {sort === "profession" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("location")}>
                        Location {sort === "location" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("created_at")}>
                        Registered {sort === "created_at" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <tr
                      key={w.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedId(w.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(w.id);
                        }
                      }}
                    >
                      <td className={styles.mono}>{w.id.slice(0, 8)}</td>
                      <td className={styles.cellStrong}>{w.name || "—"}</td>
                      <td>{w.email || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{w.phone || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{w.profession || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{w.location || <span className={styles.cellMuted}>—</span>}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${w.work_available ? styles.badgeOk : styles.badgeOff}`}
                        >
                          {w.work_available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className={styles.cellMuted}>{formatDate(w.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card layout for small screens (same data as the table). */}
          <div className={styles.cardList}>
            {workers.map((w) => (
              <button
                key={w.id}
                type="button"
                className={styles.card}
                onClick={() => setSelectedId(w.id)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{w.name || "Unnamed worker"}</span>
                  <span
                    className={`${styles.badge} ${w.work_available ? styles.badgeOk : styles.badgeOff}`}
                  >
                    {w.work_available ? "Available" : "Unavailable"}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  {w.email && <span>{w.email}</span>}
                  {w.phone && <span>{w.phone}</span>}
                  {w.profession && <span>{w.profession}</span>}
                  {w.location && <span>{w.location}</span>}
                </div>
              </button>
            ))}
          </div>

          <div className={styles.pagination}>
            <span>
              Page {page} of {totalPages} · {total} worker{total === 1 ? "" : "s"}
            </span>
            <div className={styles.pageButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
