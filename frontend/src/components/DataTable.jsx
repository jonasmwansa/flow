import { useMemo, useState } from "react";

import { td, th } from "../utils/ui";
import { Icon } from "./icons";

// A small client-side data table: search, click-to-sort columns, page-size, and
// pagination. Columns: { key, header, render?(row), sortable?, sortValue?(row) }.
export function DataTable({
  columns,
  rows,
  searchKeys = [],
  searchPlaceholder = "Search…",
  initialSort = null,
  pageSize: initialPageSize = 10,
  emptyMessage = "No records found.",
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort); // { key, dir: "asc" | "desc" }
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || searchKeys.length === 0) return rows;
    return rows.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const getVal = col.sortValue ?? ((row) => row[col.key]);
    const arr = [...filtered].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (key) => {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears the sort
    });
  };

  const sortGlyph = (key) => {
    if (!sort || sort.key !== key) return "↕";
    return sort.dir === "asc" ? "▲" : "▼";
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-500">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          entries
        </label>

        {searchKeys.length > 0 && (
          <div className="relative w-full sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={th}>
                  {col.sortable !== false ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-gray-700"
                    >
                      {col.header}
                      <span className="text-gray-300">{sortGlyph(col.key)}</span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="px-2 py-8 text-center text-gray-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((col) => (
                    <td key={col.key} className={td}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <span>
          {total === 0
            ? "No entries"
            : `Showing ${start + 1} to ${Math.min(start + pageSize, total)} of ${total} entries`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-md border border-gray-300 px-3 py-1 shadow-sm transition hover:bg-gray-50 hover:shadow disabled:opacity-50 disabled:shadow-none"
          >
            Prev
          </button>
          <span className="px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-md border border-gray-300 px-3 py-1 shadow-sm transition hover:bg-gray-50 hover:shadow disabled:opacity-50 disabled:shadow-none"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
