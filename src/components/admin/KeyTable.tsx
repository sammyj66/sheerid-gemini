"use client";

import { useEffect, useMemo, useState } from "react";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [queryParams, refreshToken]);

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
    await fetch(`/api/admin/cardkeys/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "revoke" }),
    });
    await loadData();
    onUpdated();
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

      {error && <div className="error-list">{error}</div>}

      <div className="data-table">
        <div className="data-table-head">
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
                <span className="mono">{item.code}</span>
                <span className={`status-badge ${statusPillMap[item.status]}`}>
                  {item.status}
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
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleRevoke(item.code)}
                  >
                    作废
                  </button>
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
