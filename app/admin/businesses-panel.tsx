"use client";

// Businesses management panel.
//
// Lists the real rows of `public.business_profiles`, with search, filters,
// sorting and pagination. Selecting a business opens its full profile and
// allows the editable fields to be saved back to the database through the
// admin server actions.

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import { listBusinessesAction } from "./actions";
import type { BusinessProfileRecord } from "@/types";
import { BusinessDetails } from "./business-details";
import { formatDate } from "./workers-panel";

const PER_PAGE = 15;

type SortKey = "created_at" | "name" | "email" | "city" | "category" | "status" | "rating_average";
type StatusFilter = "all" | "draft" | "published" | "suspended";

export function BusinessesPanel() {
  const [businesses, setBusinesses] = useState<BusinessProfileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBusinessesAction({
        search: search.trim() || undefined,
        category: category || undefined,
        status,
        sort,
        order,
        page,
        perPage: PER_PAGE,
      });
      setBusinesses(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load businesses");
    } finally {
      setLoading(false);
    }
  }, [search, category, status, sort, order, page]);

  // Debounce the search box so we don't hammer the database on every key.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Any filter change resets to the first page.
  useEffect(() => { setPage(1); }, [search, category, status, sort, order]);

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
      <BusinessDetails
        businessId={selectedId}
        onBack={() => { setSelectedId(null); void load(); }}
        onSaved={(updated) => {
          setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        }}
      />
    );
  }

  return (
    <div className={styles.contentInner}>
      <div>
        <h2 className={styles.sectionTitle}>Businesses</h2>
        <p className={styles.sectionHint}>
          {loading ? "Loading businesses…" : `${total} registered business${total === 1 ? "" : "es"}`}
        </p>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search by name, owner, email, phone, category or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search businesses"
        />
        <select
          className={styles.selectInput}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option className={styles.selectOption} value="all">Any status</option>
          <option className={styles.selectOption} value="published">Published</option>
          <option className={styles.selectOption} value="draft">Draft</option>
          <option className={styles.selectOption} value="suspended">Suspended</option>
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

      {loading && businesses.length === 0 ? (
        <div className={styles.stateBox}>
          <span className={styles.spinner} aria-hidden="true" />
          Loading businesses…
        </div>
      ) : businesses.length === 0 ? (
        <div className={styles.stateBox}>
          {search || status !== "all"
            ? "No businesses match the current search or filters."
            : "No businesses have been registered yet."}
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
                        Business {sort === "name" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">Owner</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("category")}>
                        Category {sort === "category" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("city")}>
                        Location {sort === "city" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("status")}>
                        Status {sort === "status" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th scope="col">
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort("created_at")}>
                        Registered {sort === "created_at" ? (order === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr
                      key={b.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedId(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(b.id);
                        }
                      }}
                    >
                      <td className={styles.mono}>{b.id.slice(0, 8)}</td>
                      <td className={styles.cellStrong}>{b.name}</td>
                      <td>{b.owner_name || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{b.email || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{b.phone || <span className={styles.cellMuted}>—</span>}</td>
                      <td>{b.category || <span className={styles.cellMuted}>—</span>}</td>
                      <td>
                        {[b.city, b.state].filter(Boolean).join(", ") || (
                          <span className={styles.cellMuted}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${statusBadgeClass(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className={styles.cellMuted}>{formatDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card layout for small screens (same data as the table). */}
          <div className={styles.cardList}>
            {businesses.map((b) => (
              <button
                key={b.id}
                type="button"
                className={styles.card}
                onClick={() => setSelectedId(b.id)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{b.name}</span>
                  <span className={`${styles.badge} ${statusBadgeClass(b.status)}`}>
                    {b.status}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  {b.owner_name && <span>{b.owner_name}</span>}
                  {b.email && <span>{b.email}</span>}
                  {b.phone && <span>{b.phone}</span>}
                  {b.category && <span>{b.category}</span>}
                  {[b.city, b.state].filter(Boolean).length > 0 && (
                    <span>{[b.city, b.state].filter(Boolean).join(", ")}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className={styles.pagination}>
            <span>
              Page {page} of {totalPages} · {total} business{total === 1 ? "" : "es"}
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

function statusBadgeClass(status: string): string {
  if (status === "published") return styles.badgeOk;
  if (status === "suspended") return styles.badgeDanger;
  if (status === "draft") return styles.badgeWarn;
  return styles.badgeOff;
}
