import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  getInvoiceHistory,
  clearInvoiceHistory,
  deleteInvoiceFromHistory,
} from "./utils/numberToWords";

const API = "http://localhost:5001";

function Dashboard({ onNavigateHome }) {
  // ---------- State ----------
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_LIMIT = 10;

  // ---------- Helpers: date range for filters ----------
  const getDateRange = (f) => {
    const now = new Date();
    if (f === "week") {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString().split("T")[0] };
    }
    if (f === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString().split("T")[0] };
    }
    return {};
  };

  // ---------- Fetch from backend (or fallback to localStorage) ----------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { from } = getDateRange(filter);

    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", PAGE_LIMIT);
      if (from) params.set("from", from);
      if (search) params.set("search", search);

      const [invRes, statsRes] = await Promise.all([
        axios.get(`${API}/invoices?${params.toString()}`),
        axios.get(`${API}/stats`),
      ]);

      const mapped = (invRes.data.invoices || []).map((inv) => ({
        id: inv._id,
        invoiceMeta: { number: inv.invoiceNumber || "N/A" },
        client: { name: inv.clientName || "No client" },
        company: { name: inv.companyName || "" },
        total: inv.totals?.total || 0,
        savedAt: inv.createdAt,
      }));

      setHistory(mapped);
      setTotalPages(invRes.data.totalPages || 1);
      setTotalCount(invRes.data.total || 0);
      setStats(statsRes.data.stats || null);
      setOffline(false);
    } catch (err) {
      console.warn("Backend unavailable, using localStorage fallback:", err?.message);
      setOffline(true);
      setError("Backend offline — showing local data");

      // ---- Fallback: localStorage ----
      const local = getInvoiceHistory();

      // Apply filter client-side
      const now = new Date();
      const filtered = local.filter((inv) => {
        const d = new Date(inv.savedAt);
        if (filter === "month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (filter === "week") {
          return (now - d) / (1000 * 60 * 60 * 24) <= 7;
        }
        return true;
      });

      // Apply search client-side
      const searched = search
        ? filtered.filter(
            (inv) =>
              (inv.invoiceMeta?.number || "").toLowerCase().includes(search.toLowerCase()) ||
              (inv.client?.name || "").toLowerCase().includes(search.toLowerCase())
          )
        : filtered;

      // Paginate client-side
      const start = (page - 1) * PAGE_LIMIT;
      const paged = searched.slice(start, start + PAGE_LIMIT);

      setHistory(paged);
      setTotalCount(searched.length);
      setTotalPages(Math.max(Math.ceil(searched.length / PAGE_LIMIT), 1));

      // Build local stats
      const total = local.reduce((s, i) => s + (i.total || 0), 0);
      const count = local.length;
      const monthInvoices = local.filter((i) => {
        const d = new Date(i.savedAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const lastMonthInvoices = local.filter((i) => {
        const d = new Date(i.savedAt);
        return d >= lastMonthStart && d <= lastMonthEnd;
      });

      const monthRevenue = monthInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const lastMonthRevenue = lastMonthInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const growth =
        lastMonthRevenue > 0
          ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : monthRevenue > 0
          ? 100
          : 0;

      // 14-day chart
      const daily = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        const dayTotal = local
          .filter((inv) => inv.savedAt?.split("T")[0] === key)
          .reduce((s, inv) => s + (inv.total || 0), 0);
        daily.push({ _id: key, total: dayTotal, count: 0 });
      }

      setStats({
        totalCount: count,
        totalRevenue: total,
        avgInvoice: count ? total / count : 0,
        monthCount: monthInvoices.length,
        monthRevenue,
        lastMonthRevenue,
        growthPercent: Number(growth.toFixed(2)),
        daily,
      });
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  // ---------- Reload on filter / search / page change ----------
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------- Reset page when filter/search changes ----------
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  // ---------- Chart data (last 14 days from stats) ----------
  const chartData = useMemo(() => {
    const now = new Date();
    const days = [];
    const dailyMap = new Map(
      (stats?.daily || []).map((d) => [d._id, d.total || 0])
    );

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days.push({
        label: d.getDate(),
        key,
        total: dailyMap.get(key) || 0,
      });
    }
    return days;
  }, [stats]);

  const maxChart = Math.max(...chartData.map((d) => d.total), 1);

  // ---------- Actions ----------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      if (!offline) {
        await axios.delete(`${API}/invoices/${id}`);
      } else {
        deleteInvoiceFromHistory(id);
      }
      setHistory((prev) => prev.filter((inv) => inv.id !== id));
      setTotalCount((c) => Math.max(c - 1, 0));
    } catch (e) {
      console.error(e);
      alert("Delete failed. Please try again.");
    }
  };

  const handleClearAll = () => {
    if (!window.confirm("Clear all invoice history? This cannot be undone.")) return;

    if (offline) {
      clearInvoiceHistory();
      setHistory([]);
      setTotalCount(0);
      setTotalPages(1);
    } else {
      alert("Clear all is only available in offline mode. Delete invoices individually.");
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  // ---------- Render ----------
  return (
    <div className="dashboard-container">
      <header className="app-header">
        <h1 className="main-title">
          <span className="title-icon">📊</span>
          <span className="title-text">Dashboard & Analytics</span>
        </h1>
        <p className="subtitle">Track your invoices, revenue and trends</p>

        {/* Status bar */}
        <div className="dashboard-status">
          <span className={`status-dot ${offline ? "offline" : "online"}`} />
          <span className="status-text">
            {offline ? "Offline mode — local data" : "Connected to server"}
          </span>
          <button
            className="filter-btn"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh"
            style={{ marginLeft: "0.5rem" }}
          >
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </header>

      {error && offline && (
        <div className="error-banner">
          <i className="fas fa-wifi"></i> {error}
        </div>
      )}

      {/* ---------- Stats Grid ---------- */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
            <i className="fas fa-file-invoice-dollar"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Invoices</span>
            <span className="stat-value">{stats?.totalCount ?? 0}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            <i className="fas fa-rupee-sign"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">₹{(stats?.totalRevenue ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg. Invoice</span>
            <span className="stat-value">₹{(stats?.avgInvoice ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}>
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">This Month</span>
            <span className="stat-value">₹{(stats?.monthRevenue ?? 0).toFixed(2)}</span>
            <span className="stat-sub">
              {stats?.monthCount ?? 0} invoices
              {stats?.growthPercent !== undefined && stats?.growthPercent !== 0 && (
                <span
                  className="growth-badge"
                  style={{
                    color: stats.growthPercent >= 0 ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {" "}
                  {stats.growthPercent >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(stats.growthPercent)}%
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Chart ---------- */}
      <div className="card glass">
        <h2 className="section-header">
          <span className="section-icon">📈</span> Revenue (Last 14 Days)
        </h2>
        <div className="bar-chart">
          {chartData.map((d) => (
            <div key={d.key} className="bar-col" title={`₹${d.total.toFixed(2)}`}>
              <div className="bar-wrap">
                <div
                  className="bar-fill"
                  style={{ height: `${(d.total / maxChart) * 100}%` }}
                />
              </div>
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- History ---------- */}
      <div className="card glass">
        <div className="history-header">
          <h2 className="section-header" style={{ marginBottom: 0 }}>
            <span className="section-icon">🧾</span> Invoice History
            <span className="count-badge">{totalCount}</span>
          </h2>

          <div className="filter-group">
            {["all", "month", "week"].map((f) => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {offline && history.length > 0 && (
              <button className="filter-btn danger" onClick={handleClearAll}>
                <i className="fas fa-trash"></i> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="search-bar">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by invoice # or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search" onClick={() => setSearch("")}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="empty-state">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading invoices...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <p>
              {search
                ? `No invoices match "${search}"`
                : "No invoices yet. Generate your first invoice!"}
            </p>
       <button
  className="button create-invoice-btn"
  onClick={onNavigateHome}
>
  <i className="fas fa-plus"></i> Create Invoice
</button>

          </div>
        ) : (
          <>
            <div className="history-list">
              {history.map((inv) => (
                <div key={inv.id} className="history-item">
                  <div className="history-main">
                    <div className="history-badge">
                      <i className="fas fa-file-invoice"></i>
                    </div>
                    <div className="history-info">
                      <span className="history-number">
                        {inv.invoiceMeta?.number || "N/A"}
                      </span>
                      <span className="history-client">
                        {inv.client?.name || "No client"} •{" "}
                        {new Date(inv.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="history-right">
                    <span className="history-total">
                      ₹{(inv.total || 0).toFixed(2)}
                    </span>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleDelete(inv.id)}
                      title="Delete"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                >
                  <i className="fas fa-chevron-left"></i> Prev
                </button>
                <span className="page-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="page-btn"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                >
                  Next <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;