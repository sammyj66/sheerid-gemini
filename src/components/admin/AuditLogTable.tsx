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

  const handleClearLogs = async () => {
    if (!confirm("确定清空所有审计日志吗？此操作不可恢复。")) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/logs", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert((data as { error?: string })?.error || "清空日志失败");
        return;
      }
      setLogs([]);
      setTotal(0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [refreshToken]);

  const actionLabelMap: Record<string, string> = {
    list_cardkeys: "查看卡密列表",
    create_cardkeys: "生成卡密",
    delete_cardkey: "删除卡密",
    revoke_cardkey: "作废卡密",
    restore_cardkey: "恢复卡密",
    export_cardkeys: "导出卡密",
    view_logs: "查看日志",
    clear_logs: "清空日志",
    login_success: "登录成功",
    login_failed: "登录失败",
    login_rate_limited: "登录限流",
  };

  const statusLabelMap: Record<string, string> = {
    ALL: "全部",
    UNUSED: "未使用",
    LOCKED: "已锁定",
    CONSUMED: "已消耗",
    USED: "已使用",
    REVOKED: "已作废",
    EXPIRED: "已过期",
  };

  const parseDetailPairs = (detail: string) => {
    return detail
      .trim()
      .split(/\s+/)
      .map((segment) => segment.split("="))
      .reduce<Record<string, string>>((acc, [key, value]) => {
        if (key) acc[key] = value ?? "";
        return acc;
      }, {});
  };

  const formatDetail = (action: string, detail: string | null) => {
    if (!detail) return "-";
    if (action === "login_failed" && detail === "wrong_password") {
      return "密码错误";
    }
    if (action === "login_rate_limited") {
      const retryMatch = detail.match(/retry_after=([0-9]+s)/);
      return retryMatch
        ? `触发限流，等待 ${retryMatch[1]} 后重试`
        : "触发限流";
    }
    if (action === "list_cardkeys") {
      const pairs = parseDetailPairs(detail);
      const statusLabel = statusLabelMap[pairs.status] || pairs.status || "全部";
      const query = pairs.q ? decodeURIComponent(pairs.q) : "";
      const page = pairs.page || "1";
      return `状态=${statusLabel} 关键词=${query || "无"} 页码=${page}`;
    }
    if (action === "create_cardkeys") {
      const pairs = parseDetailPairs(detail);
      return `数量=${pairs.count || "-"} 批次=${pairs.batch || "-"}`;
    }
    if (
      action === "delete_cardkey" ||
      action === "revoke_cardkey" ||
      action === "restore_cardkey"
    ) {
      const pairs = parseDetailPairs(detail);
      return `卡密=${pairs.code || "-"}`;
    }
    if (action === "export_cardkeys") {
      const pairs = parseDetailPairs(detail);
      const statusLabel = statusLabelMap[pairs.status] || pairs.status || "全部";
      const query = pairs.q ? decodeURIComponent(pairs.q) : "";
      return `格式=${(pairs.format || "csv").toUpperCase()} 状态=${statusLabel} 关键词=${query || "无"}`;
    }
    if (action === "view_logs") {
      return "查看日志记录";
    }
    if (action === "clear_logs") {
      const pairs = parseDetailPairs(detail);
      const deleted = pairs.deleted || "-";
      return `已清空 ${deleted} 条`;
    }
    return detail;
  };

  const formatAction = (action: string) => actionLabelMap[action] || action;

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <div>
          <div className="card-title">审计日志</div>
          <div className="card-note">记录管理员操作历史</div>
        </div>
        <div className="toolbar">
          <button type="button" className="ghost-button" onClick={() => loadLogs()}>
            刷新
          </button>
          <button
            type="button"
            className="ghost-button danger"
            onClick={handleClearLogs}
          >
            清空日志
          </button>
        </div>
      </div>

      <div className="data-table audit-table">
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
              <span className="mono">{formatAction(log.action)}</span>
              <span>{formatDetail(log.action, log.detail)}</span>
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
