"use client";

import { useState } from "react";

export type VerificationStatus =
  | "processing"
  | "pending"
  | "success"
  | "fail"
  | "error"
  | "timeout"
  | "duplicate";

export type VerificationProgressItem = {
  index: number;
  link: string;
  cardKey: string;
  verificationId?: string;
  status: VerificationStatus;
  keyStatus?: "consumed" | "locked" | "unused";
  message?: string;
  resultUrl?: string;
  jobId?: string;
};

const statusLabel: Record<VerificationStatus, string> = {
  processing: "Processing",
  pending: "Pending",
  success: "Success",
  fail: "Fail",
  error: "Error",
  timeout: "Timeout",
  duplicate: "Success",
};

const statusIcon: Record<VerificationStatus, string> = {
  processing: "⏳",
  pending: "🔄",
  success: "✅",
  fail: "❌",
  error: "❌",
  timeout: "⏰",
  duplicate: "✅",
};

function getKeyBadge(status: VerificationStatus, keyStatus?: VerificationProgressItem["keyStatus"]) {
  if (keyStatus === "consumed") return "卡密已消耗";
  if (keyStatus === "locked") return "卡密已锁定";
  if (keyStatus === "unused") return "卡密未消耗";
  if (status === "success" || status === "duplicate") return "卡密已消耗";
  if (status === "processing" || status === "pending") return "卡密已锁定";
  return "卡密已回滚";
}

export default function VerificationProgress({
  items,
}: {
  items: VerificationProgressItem[];
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const completedStatuses = new Set<VerificationStatus>([
    "success",
    "fail",
    "error",
    "timeout",
    "duplicate",
  ]);

  const completedCount = items.filter((item) =>
    completedStatuses.has(item.status)
  ).length;

  const percent = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  const handleCopy = async (index: number, value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="progress-wrapper">
      <div className="card-header">
        <div>
          <div className="card-title">验证进度</div>
          <div className="card-note">
            已完成 {completedCount}/{items.length}
          </div>
        </div>
        <div className="progress-meta">{percent}%</div>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      {items.length === 0 ? (
        <div className="progress-empty">
          <div className="progress-placeholder">
            <div className="placeholder-bar" />
            <div className="placeholder-bar short" />
            <div className="placeholder-bar" />
          </div>
          <div className="card-note">提交后会在此显示实时进度。</div>
        </div>
      ) : (
        <div className="progress-list">
          {items.map((item) => {
            const statusClass = item.status === "duplicate" ? "success" : item.status;
            return (
            <div className="progress-item" key={item.index}>
              <div className="progress-top">
                <div className={`status-badge status-${statusClass}`}>
                  {statusIcon[item.status]} {statusLabel[item.status]}
                </div>
                <div className="key-badge">{getKeyBadge(item.status, item.keyStatus)}</div>
              </div>

              {item.verificationId && (
                <div className="progress-meta">
                  verificationId: {item.verificationId}
                </div>
              )}

              <div className="progress-link">{item.link}</div>

              {item.resultUrl && (
                <div className="copy-row">
                  <span className="progress-meta">结果链接:</span>
                  <span className="progress-link">{item.resultUrl}</span>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => handleCopy(item.index, item.resultUrl)}
                  >
                    {copiedIndex === item.index ? "已复制" : "复制"}
                  </button>
                </div>
              )}

              {item.message && (
                <div className="progress-meta">提示: {item.message}</div>
              )}
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
