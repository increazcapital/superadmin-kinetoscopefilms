/* ============================================================
   Component: DataTable.jsx
   Description: Reusable table with search, sort, pagination
   ============================================================ */

import { useState, useMemo } from 'react';

export default function DataTable({ columns, data, onRowClick, searchPlaceholder = 'Search...', pageSize = 10 }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // Filter data by search
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();

    const searchObjValues = (obj, depth = 0) => {
      if (!obj || depth > 5) return false;
      if (typeof obj === 'string' || typeof obj === 'number') {
        const str = String(obj);
        if (str === '[object Object]') return false;
        return str.toLowerCase().includes(term);
      }
      if (typeof obj === 'object') {
        return Object.values(obj).some(v => searchObjValues(v, depth + 1));
      }
      return false;
    };

    return data.filter(row => {
      // 1. Check columns with accessor or searchKey
      const hasColumnMatch = columns.some(col => {
        if (col.searchKey) {
          const val = row[col.searchKey];
          if (val !== undefined && val !== null && typeof val !== 'object' && String(val).toLowerCase().includes(term)) return true;
        }
        if (col.accessor) {
          const val = row[col.accessor];
          if (val !== undefined && val !== null && typeof val !== 'object' && String(val).toLowerCase().includes(term)) return true;
        }
        return false;
      });

      if (hasColumnMatch) return true;

      // 2. Fallback: Search all values in row object recursively
      return searchObjValues(row);
    });
  }, [data, search, columns]);

  // Sort data
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  // Handle sort click
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Reset page on search
  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="kfpl-table-container">
      {/* Toolbar */}
      <div className="kfpl-table-toolbar">
        <div className="kfpl-table-toolbar-left">
          <div className="kfpl-search">
            <svg className="kfpl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={handleSearch}
            />
          </div>
          <span className="kfpl-table-count">
            Showing <strong>{paginated.length}</strong> of <strong>{filtered.length}</strong> results
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="kfpl-table-scroll">
        <table className="kfpl-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.accessor || col.header}
                  onClick={() => col.accessor && handleSort(col.accessor)}
                  className={sortKey === col.accessor ? 'sorted' : ''}
                >
                  {col.header}
                  {col.accessor && (
                    <span className="sort-icon">
                      {sortKey === col.accessor ? (
                        sortDir === 'asc' ? '↑' : '↓'
                      ) : '↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                  No results found
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map(col => (
                    <td key={col.accessor || col.header}>
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="kfpl-pagination">
          <span className="kfpl-pagination-info">
            Page {page} of {totalPages}
          </span>
          <div className="kfpl-pagination-controls">
            <button
              className="kfpl-pagination-btn"
              disabled={page === 1}
              onClick={() => setPage(1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
            </button>
            <button
              className="kfpl-pagination-btn"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {getPageNumbers().map(p => (
              <button
                key={p}
                className={`kfpl-pagination-btn ${p === page ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="kfpl-pagination-btn"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button
              className="kfpl-pagination-btn"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ END: DataTable.jsx ============ */
