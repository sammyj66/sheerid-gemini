"use client";

import { useState } from "react";

type KeyGeneratorProps = {
  onGenerated?: () => void;
};

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function KeyGenerator({ onGenerated }: KeyGeneratorProps) {
  const [count, setCount] = useState(10);
  const [batchNo, setBatchNo] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/cardkeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          count,
          batchNo: batchNo || undefined,
          note: note || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "生成失败");
      }

      setGenerated(data.keys || []);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (generated.length === 0) return;
    await navigator.clipboard.writeText(generated.join("\n"));
  };

  const handleExport = (format: "csv" | "json") => {
    if (generated.length === 0) return;
    if (format === "json") {
      downloadFile(
        "generated-keys.json",
        JSON.stringify({ keys: generated }, null, 2),
        "application/json"
      );
      return;
    }
    const csv = ["code", ...generated].join("\n");
    downloadFile("generated-keys.csv", csv, "text/csv");
  };

  return (
    <div className="form">
      <div className="card-header">
        <div>
          <div className="card-title">卡密生成器</div>
          <div className="card-note">支持批量生成与导出</div>
        </div>
      </div>

      <div className="field">
        <label className="label">生成数量 (1-100)</label>
        <input
          className="input"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        />
      </div>

      <div className="grid-two">
        <div className="field">
          <label className="label">批次号 (可选)</label>
          <input
            className="input"
            value={batchNo}
            onChange={(event) => setBatchNo(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">过期时间 (可选)</label>
          <input
            className="input"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="label">备注</label>
        <input
          className="input"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {error && <div className="error-list">{error}</div>}

      <button
        type="button"
        className="primary-button"
        disabled={loading}
        onClick={handleGenerate}
      >
        {loading ? "生成中..." : "生成卡密"}
      </button>

      {generated.length > 0 && (
        <div className="admin-panel">
          <div className="card-title">生成结果</div>
          <div className="generated-list">
            {generated.map((code) => (
              <div className="key-chip" key={code}>
                {code}
              </div>
            ))}
          </div>
          <div className="toolbar">
            <button type="button" className="ghost-button" onClick={handleCopy}>
              复制全部
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleExport("csv")}
            >
              导出 CSV
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleExport("json")}
            >
              导出 JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
