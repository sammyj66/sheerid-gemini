"use client";

import { useEffect, useState } from "react";

type AdminLog = {
  id: string;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
};

type AuditLogTableProps = {
  refreshToken: number;
};

export default function AuditLogTable({ refreshToken }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadLogs = async (targetPage = page) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/logs?page=${targetPage}&limit=${limit}`,
        { credentials: "include" }
      );
      const data = await response.json();
      if (response.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || targetPage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [refreshToken]);

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <div>
          <div className="card-title">审计日志</div>
          <div className="card-note">记录管理员操作历史</div>
        </div>
        <button type="button" className="ghost-button" onClick={() => loadLogs()}>
          刷新
        </button>
      </div>

      <div className="data-table">
        <div className="data-table-head">
          <span>时间</span>
          <span>动作</span>
          <span>详情</span>
          <span>IP</span>
        </div>
        {loading ? (
          <div className="table-empty">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="table-empty">暂无日志</div>
        ) : (
          logs.map((log) => (
            <div className="data-table-row" key={log.id}>
              <span>{new Date(log.createdAt).toLocaleString()}</span>
              <span className="mono">{log.action}</span>
              <span>{log.detail || "-"}</span>
              <span>{log.ip || "-"}</span>
            </div>
          ))
        )}
      </div>

      <div className="pagination">
        <span className="card-note">
          共 {total} 条，页数 {page}/{totalPages}
        </span>
        <div className="toolbar">
          <button
            type="button"
            className="ghost-button"
            disabled={page <= 1}
            onClick={() => loadLogs(page - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={page >= totalPages}
            onClick={() => loadLogs(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
