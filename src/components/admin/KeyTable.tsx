"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CardKey = {
  code: string;
  status: string;
  batchNo: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  consumedAt: string | null;
};

type KeyTableProps = {
  filters: {
    status: string;
    query: string;
    page: number;
    limit: number;
  };
  onFiltersChange: (filters: KeyTableProps["filters"]) => void;
  refreshToken: number;
  onUpdated: () => void;
};

const statusOptions = [
  { value: "ALL", label: "全部" },
  { value: "UNUSED", label: "未使用" },
  { value: "LOCKED", label: "已锁定" },
  { value: "CONSUMED", label: "已消耗" },
  { value: "REVOKED", label: "已作废" },
  { value: "EXPIRED", label: "已过期" },
];

const statusPillMap: Record<string, string> = {
  UNUSED: "status-success",
  LOCKED: "status-pending",
  CONSUMED: "status-processing",
  REVOKED: "status-error",
  EXPIRED: "status-timeout",
};

const statusLabelMap: Record<string, string> = {
  UNUSED: "未使用",
  LOCKED: "已锁定",
  CONSUMED: "已消耗",
  USED: "已使用",
  REVOKED: "已作废",
  EXPIRED: "已过期",
};

export default function KeyTable({
  filters,
  onFiltersChange,
  refreshToken,
  onUpdated,
}: KeyTableProps) {
  const [items, setItems] = useState<CardKey[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", filters.status || "ALL");
    params.set("q", filters.query || "");
    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));
    return params.toString();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/cardkeys?${queryParams}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "加载失败");
      }
      setItems(data.keys || []);
      setTotal(data.total || 0);
      setSelectedCodes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryParams, refreshToken]);

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const allSelected = items.length > 0 && items.every((item) => selectedSet.has(item.code));
  const someSelected = items.some((item) => selectedSet.has(item.code));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && someSelected;
    }
  }, [allSelected, someSelected]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(items.map((item) => item.code));
    }
  };

  const toggleSelectOne = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value, page: 1 });
  };

  const handleQueryChange = (value: string) => {
    onFiltersChange({ ...filters, query: value, page: 1 });
  };

  const handleLimitChange = (value: number) => {
    onFiltersChange({ ...filters, limit: value, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    onFiltersChange({ ...filters, page: nextPage });
  };

  const handleRevoke = async (code: string) => {
    const prevItems = items;
    const prevTotal = total;
    const shouldRemove =
      filters.status !== "ALL" && filters.status !== "REVOKED";

    if (shouldRemove) {
      setItems((prev) => prev.filter((item) => item.code !== code));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.code === code ? { ...item, status: "REVOKED" } : item
        )
      );
    }

    try {
      const response = await fetch(`/api/admin/cardkeys/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "作废失败");
      }
      onUpdated();
    } catch (err) {
      setItems(prevItems);
      setTotal(prevTotal);
      alert(err instanceof Error ? err.message : "作废失败");
    }
  };

  const handleBulkRevoke = async () => {
    if (selectedCodes.length === 0) return;
    if (!confirm(`确定作废选中的 ${selectedCodes.length} 条卡密吗？`)) return;

    const prevItems = items;
    const prevTotal = total;
    const shouldRemove = filters.status !== "ALL" && filters.status !== "REVOKED";
    const selectedSetLocal = new Set(selectedCodes);

    if (shouldRemove) {
      const removeCount = items.filter((item) => selectedSetLocal.has(item.code)).length;
      setItems((prev) => prev.filter((item) => !selectedSetLocal.has(item.code)));
      setTotal((prev) => Math.max(0, prev - removeCount));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          selectedSetLocal.has(item.code) ? { ...item, status: "REVOKED" } : item
        )
      );
    }

    try {
      const responses = await Promise.all(
        selectedCodes.map((code) =>
          fetch(`/api/admin/cardkeys/${code}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "revoke" }),
          })
        )
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "批量作废失败");
      }
      setSelectedCodes([]);
      onUpdated();
    } catch (err) {
      setItems(prevItems);
      setTotal(prevTotal);
      alert(err instanceof Error ? err.message : "批量作废失败");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCodes.length === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCodes.length} 条卡密吗？`)) return;

    const prevItems = items;
    const prevTotal = total;
    const selectedSetLocal = new Set(selectedCodes);
    const removeCount = items.filter((item) => selectedSetLocal.has(item.code)).length;
    setItems((prev) => prev.filter((item) => !selectedSetLocal.has(item.code)));
    setTotal((prev) => Math.max(0, prev - removeCount));

    try {
      const responses = await Promise.all(
        selectedCodes.map((code) =>
          fetch(`/api/admin/cardkeys/${code}`, {
            method: "DELETE",
            credentials: "include",
          })
        )
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "批量删除失败");
      }
      setSelectedCodes([]);
      onUpdated();
    } catch (err) {
      setItems(prevItems);
      setTotal(prevTotal);
      alert(err instanceof Error ? err.message : "批量删除失败");
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkExport = (format: "csv" | "txt") => {
    if (selectedCodes.length === 0) return;
    const selectedSetLocal = new Set(selectedCodes);
    const selectedItems = items.filter((item) => selectedSetLocal.has(item.code));

    if (format === "txt") {
      const content = selectedItems.map((item) => item.code).join("\n");
      downloadFile(content, "cardkeys.txt", "text/plain;charset=utf-8");
      return;
    }

    const header = [
      "code",
      "status",
      "batchNo",
      "note",
      "createdAt",
      "expiresAt",
      "consumedAt",
    ];
    const rows = selectedItems.map((item) => [
      item.code,
      statusLabelMap[item.status] || item.status,
      item.batchNo || "",
      item.note || "",
      item.createdAt,
      item.expiresAt || "",
      item.consumedAt || "",
    ]);
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    downloadFile(csv, "cardkeys.csv", "text/csv;charset=utf-8");
  };

  const handleRestore = async (code: string) => {
    const prevItems = items;
    const prevTotal = total;
    const shouldRemove =
      filters.status !== "ALL" && filters.status !== "UNUSED";

    if (shouldRemove) {
      setItems((prev) => prev.filter((item) => item.code !== code));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.code === code ? { ...item, status: "UNUSED" } : item
        )
      );
    }

    try {
      const response = await fetch(`/api/admin/cardkeys/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || "恢复失败");
      }
      onUpdated();
    } catch (err) {
      setItems(prevItems);
      setTotal(prevTotal);
      alert(err instanceof Error ? err.message : "恢复失败");
    }
  };

  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 1200);
    } catch {
      alert("复制失败");
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`确定删除卡密 ${code} 吗？`)) return;
    const response = await fetch(`/api/admin/cardkeys/${code}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data?.error || "删除失败");
      return;
    }
    await loadData();
    onUpdated();
  };

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <div className="toolbar">
          <select
            className="input"
            value={filters.status}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="搜索卡密或批次号"
            value={filters.query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        </div>
        <div className="toolbar">
          <button type="button" className="ghost-button" onClick={loadData}>
            刷新
          </button>
          <select
            className="input"
            value={filters.limit}
            onChange={(event) => handleLimitChange(Number(event.target.value))}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}/页
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCodes.length > 0 && (
        <div className="bulk-actions">
          <span className="card-note">已选中 {selectedCodes.length} 条</span>
          <div className="toolbar">
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleBulkExport("csv")}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleBulkExport("txt")}
            >
              导出 TXT
            </button>
            <button type="button" className="ghost-button" onClick={handleBulkRevoke}>
              作废
            </button>
            <button
              type="button"
              className="ghost-button danger"
              onClick={handleBulkDelete}
            >
              删除
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-list" role="status" aria-live="polite">
          {error}
        </div>
      )}

      <div className="data-table">
        <div className="data-table-head">
          <span>
            <input
              ref={selectAllRef}
              type="checkbox"
              className="table-checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="全选"
            />
          </span>
          <span>卡密</span>
          <span>状态</span>
          <span>批次号</span>
          <span>创建时间</span>
          <span>操作</span>
        </div>
        {loading ? (
          <div className="table-empty">加载中...</div>
        ) : items.length === 0 ? (
          <div className="table-empty">暂无数据</div>
        ) : (
          items.map((item) => (
            <div key={item.code}>
              <div className="data-table-row">
                <span>
                  <input
                    type="checkbox"
                    className="table-checkbox"
                    checked={selectedSet.has(item.code)}
                    onChange={() => toggleSelectOne(item.code)}
                    aria-label={`选择卡密 ${item.code}`}
                  />
                </span>
                <span
                  className="mono copyable"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCopy(item.code)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleCopy(item.code);
                    }
                  }}
                >
                  {item.code}
                  {copiedCode === item.code && (
                    <span className="copy-hint">已复制</span>
                  )}
                </span>
                <span className={`status-badge ${statusPillMap[item.status]}`}>
                  {statusLabelMap[item.status] || item.status}
                </span>
                <span>{item.batchNo || "-"}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <span className="row-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setExpanded((prev) => (prev === item.code ? null : item.code))
                    }
                  >
                    详情
                  </button>
                  {item.status === "REVOKED" ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleRestore(item.code)}
                    >
                      恢复
                    </button>
                  ) : item.status === "UNUSED" || item.status === "CONSUMED" ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleRevoke(item.code)}
                    >
                      作废
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => handleDelete(item.code)}
                  >
                    删除
                  </button>
                </span>
              </div>
              {expanded === item.code && (
                <div className="data-table-detail">
                  <div>备注: {item.note || "-"}</div>
                  <div>过期时间: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "-"}</div>
                  <div>消耗时间: {item.consumedAt ? new Date(item.consumedAt).toLocaleString() : "-"}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pagination">
        <span className="card-note">
          共 {total} 条，页数 {filters.page}/{totalPages}
        </span>
        <div className="toolbar">
          <button
            type="button"
            className="ghost-button"
            disabled={filters.page <= 1}
            onClick={() => handlePageChange(filters.page - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={filters.page >= totalPages}
            onClick={() => handlePageChange(filters.page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
