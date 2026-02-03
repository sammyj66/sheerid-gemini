"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import MaskedDateInput from "./MaskedDateInput";

type CardKey = {
  code: string;
  status: string;
  maxUses: number;
  usedCount: number;
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

type EditField = "code" | "maxUses" | "expiresAt";

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

function formatLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.includes(" ")
      ? trimmed.replace(" ", "T")
      : `${trimmed}T00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("过期时间格式错误，请使用 YYYY-MM-DD HH:mm");
  }
  return parsed.toISOString();
}

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
  const [selectAllAcross, setSelectAllAcross] = useState(false);
  const [editing, setEditing] = useState<{ code: string; field: EditField } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const skipBlurRef = useRef(false);

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
      setSelectAllAcross(false);
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
  const allSelected =
    selectAllAcross ||
    (items.length > 0 && items.every((item) => selectedSet.has(item.code)));
  const someSelected =
    !selectAllAcross && items.some((item) => selectedSet.has(item.code));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && someSelected;
    }
  }, [allSelected, someSelected]);

  const toggleSelectAll = async () => {
    if (allSelected) {
      setSelectedCodes([]);
      setSelectAllAcross(false);
      return;
    }
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("status", filters.status || "ALL");
      queryParams.set("q", filters.query || "");
      queryParams.set("all", "1");
      queryParams.set("fields", "code");
      const response = await fetch(`/api/admin/cardkeys?${queryParams.toString()}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "全选失败");
      }
      const codes = Array.isArray(data.keys)
        ? data.keys.map((item: { code: string }) => item.code)
        : [];
      setSelectedCodes(codes);
      setSelectAllAcross(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "全选失败");
    }
  };

  const toggleSelectOne = (code: string) => {
    setSelectAllAcross(false);
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
      setSelectAllAcross(false);
      onUpdated();
      await loadData();
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
      setSelectAllAcross(false);
      onUpdated();
      await loadData();
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

  const handleBulkExport = async (format: "csv" | "txt") => {
    if (selectedCodes.length === 0) return;
    const selectedSetLocal = new Set(selectedCodes);
    let selectedItems = items.filter((item) => selectedSetLocal.has(item.code));

    if (selectAllAcross) {
      const queryParams = new URLSearchParams();
      queryParams.set("status", filters.status || "ALL");
      queryParams.set("q", filters.query || "");
      queryParams.set("all", "1");
      const response = await fetch(`/api/admin/cardkeys?${queryParams.toString()}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data?.error || "导出失败");
        return;
      }
      selectedItems = Array.isArray(data.keys) ? data.keys : [];
    }

    if (format === "txt") {
      const content = selectedItems.map((item) => item.code).join("\n");
      downloadFile(content, "cardkeys.txt", "text/plain;charset=utf-8");
      return;
    }

    const header = [
      "code",
      "status",
      "maxUses",
      "usedCount",
      "remaining",
      "batchNo",
      "note",
      "createdAt",
      "expiresAt",
      "consumedAt",
    ];
    const rows = selectedItems.map((item: CardKey) => [
      item.code,
      statusLabelMap[item.status] || item.status,
      String(item.maxUses ?? 1),
      String(item.usedCount ?? 0),
      String((item.maxUses ?? 1) - (item.usedCount ?? 0)),
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

  const startEdit = (item: CardKey, field: EditField) => {
    setEditing({ code: item.code, field });
    setEditError(null);
    if (field === "code") {
      setEditValue(item.code);
    } else if (field === "maxUses") {
      setEditValue(String(item.maxUses ?? 1));
    } else {
      setEditValue(formatLocalDateTime(item.expiresAt));
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
    setEditValue("");
  };

  const applyUpdatedCardKey = (prevCode: string, updated?: CardKey) => {
    if (!updated) return;
    setItems((prev) =>
      prev.map((item) => (item.code === prevCode ? updated : item))
    );
    setSelectedCodes((prev) =>
      prev.map((code) => (code === prevCode ? updated.code : code))
    );
    setExpanded((prev) => (prev === prevCode ? updated.code : prev));
  };

  const saveEdit = async (item: CardKey) => {
    if (!editing) return;
    const field = editing.field;
    const prevItems = items;
    try {
      if (field === "code") {
        const newCode = editValue.trim();
        if (!newCode) {
          throw new Error("卡密不能为空");
        }
        if (newCode === item.code) {
          cancelEdit();
          return;
        }
        const response = await fetch(`/api/admin/cardkeys/${item.code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "set_code", newCode }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error || "更新失败");
        }
        if (data?.cardKey) {
          applyUpdatedCardKey(item.code, data.cardKey as CardKey);
        } else {
          setItems((prev) =>
            prev.map((row) =>
              row.code === item.code ? { ...row, code: newCode } : row
            )
          );
        }
      }

      if (field === "maxUses") {
        const nextMaxUses = Number(editValue);
        if (
          !Number.isInteger(nextMaxUses) ||
          nextMaxUses < 1 ||
          nextMaxUses > 1000
        ) {
          throw new Error("可验证次数必须为 1-1000 的整数");
        }
        setItems((prev) =>
          prev.map((row) =>
            row.code === item.code
              ? {
                  ...row,
                  maxUses: nextMaxUses,
                  usedCount: Math.min(row.usedCount ?? 0, nextMaxUses),
                }
              : row
          )
        );
        const response = await fetch(`/api/admin/cardkeys/${item.code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "set_uses", maxUses: nextMaxUses }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error || "更新失败");
        }
        applyUpdatedCardKey(item.code, data.cardKey as CardKey);
      }

      if (field === "expiresAt") {
        const nextExpiresAt = parseDateTimeInput(editValue);
        const response = await fetch(`/api/admin/cardkeys/${item.code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "set_expires",
            expiresAt: nextExpiresAt,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error || "更新失败");
        }
        applyUpdatedCardKey(item.code, data.cardKey as CardKey);
      }

      cancelEdit();
      onUpdated();
    } catch (err) {
      setItems(prevItems);
      setEditError(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: CardKey) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipBlurRef.current = true;
      void saveEdit(item);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlurRef.current = true;
      cancelEdit();
    }
  };

  const handleEditBlur = (item: CardKey) => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    if (!editing || editing.code !== item.code) {
      return;
    }
    void saveEdit(item);
  };

  const isEditingField = (item: CardKey, field: EditField) =>
    editing?.code === item.code && editing.field === field;

  const handleDelete = async (item: CardKey) => {
    const remaining = (item.maxUses ?? 1) - (item.usedCount ?? 0);
    const needsConfirm = (item.usedCount ?? 0) > 0;
    if (
      needsConfirm &&
      !confirm(
        `该卡密已被使用 ${item.usedCount ?? 0} 次，剩余 ${remaining} 次可用。是否确认删除？`
      )
    ) {
      return;
    }

    const doDelete = async (force: boolean) => {
      const response = await fetch(
        `/api/admin/cardkeys/${item.code}${force ? "?force=1" : ""}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    let { response, data } = await doDelete(needsConfirm);
    if (!response.ok) {
      if (response.status === 409 && data?.jobCount) {
        const jobCount = data.jobCount as number;
        const usedCount = data.usedCount ?? item.usedCount ?? 0;
        const remainingUses = data.remainingUses ?? remaining;
        const message = `该卡密已有 ${jobCount} 条验证记录，已使用 ${usedCount} 次，剩余 ${remainingUses} 次。是否确认强制删除？`;
        if (confirm(message)) {
          ({ response, data } = await doDelete(true));
        } else {
          return;
        }
      } else {
        alert(data?.error || "删除失败");
        return;
      }
    }
    if (!response.ok) {
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
          <span>次数</span>
          <span>过期时间</span>
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
                <div className="inline-cell">
                  {isEditingField(item, "code") ? (
                    <input
                      className="input input-compact"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => handleEditKeyDown(event, item)}
                      onBlur={() => handleEditBlur(item)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="editable-cell mono"
                      role="button"
                      tabIndex={0}
                      onClick={() => startEdit(item, "code")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          startEdit(item, "code");
                        }
                      }}
                    >
                      {item.code}
                    </span>
                  )}
                  {!isEditingField(item, "code") && (
                    <button
                      type="button"
                      className="ghost-button ghost-button--tiny"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCopy(item.code);
                      }}
                    >
                      复制
                    </button>
                  )}
                  {copiedCode === item.code && (
                    <span className="copy-hint">已复制</span>
                  )}
                </div>
                <span className={`status-badge ${statusPillMap[item.status]}`}>
                  {statusLabelMap[item.status] || item.status}
                </span>
                <span>
                  {isEditingField(item, "maxUses") ? (
                    <div className="inline-cell">
                      <span className="muted-text">{item.usedCount ?? 0} /</span>
                      <input
                        className="input input-compact"
                        type="number"
                        min={1}
                        max={1000}
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onKeyDown={(event) => handleEditKeyDown(event, item)}
                        onBlur={() => handleEditBlur(item)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span
                      className="editable-cell"
                      role="button"
                      tabIndex={0}
                      onClick={() => startEdit(item, "maxUses")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          startEdit(item, "maxUses");
                        }
                      }}
                    >
                      {item.usedCount ?? 0}/{item.maxUses ?? 1}
                    </span>
                  )}
                </span>
                <span>
                  {isEditingField(item, "expiresAt") ? (
                    <MaskedDateInput
                      className="input input-compact"
                      value={editValue}
                      onChange={setEditValue}
                      onKeyDown={(event) => handleEditKeyDown(event, item)}
                      onBlur={() => handleEditBlur(item)}
                    />
                  ) : (
                    <span
                      className="editable-cell"
                      role="button"
                      tabIndex={0}
                      onClick={() => startEdit(item, "expiresAt")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          startEdit(item, "expiresAt");
                        }
                      }}
                    >
                      {formatLocalDateTime(item.expiresAt) || "-"}
                    </span>
                  )}
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
                    onClick={() => handleDelete(item)}
                  >
                    删除
                  </button>
                </span>
              </div>
              {editing?.code === item.code && editError && (
                <div className="data-table-detail">
                  <div className="error-list" role="status" aria-live="polite">
                    {editError}
                  </div>
                </div>
              )}
              {expanded === item.code && (
                <div className="data-table-detail">
                  <div>备注: {item.note || "-"}</div>
                  <div>
                    已用次数: {item.usedCount ?? 0} / {item.maxUses ?? 1}
                  </div>
                  <div>
                    剩余次数: {(item.maxUses ?? 1) - (item.usedCount ?? 0)}
                  </div>
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
