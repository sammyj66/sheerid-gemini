"use client";

import { useState } from "react";
import MaskedDateInput from "./MaskedDateInput";

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
  const [count, setCount] = useState("10");
  const [maxUses, setMaxUses] = useState("1");
  const [batchNo, setBatchNo] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clampNumericInput = (
    value: string,
    min: number,
    max: number,
    fallback: string
  ) => {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const clamped = Math.min(max, Math.max(min, Math.floor(parsed)));
    return String(clamped);
  };

  const parseExpiresAt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
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
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const parsedCount = Number(count);
      if (
        !Number.isInteger(parsedCount) ||
        parsedCount < 1 ||
        parsedCount > 100
      ) {
        throw new Error("生成数量必须为 1-100 的整数");
      }

      const parsedMaxUses = Number(maxUses);
      if (
        !Number.isInteger(parsedMaxUses) ||
        parsedMaxUses < 1 ||
        parsedMaxUses > 1000
      ) {
        throw new Error("可验证次数必须为 1-1000 的整数");
      }

      const expiresAtIso = expiresAt ? parseExpiresAt(expiresAt) : undefined;

      const response = await fetch("/api/admin/cardkeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          count: parsedCount,
          maxUses: parsedMaxUses,
          batchNo: batchNo || undefined,
          note: note || undefined,
          expiresAt: expiresAtIso,
        }),
      });

      const text = await response.text();
      let data: { error?: string; keys?: string[] } = {};
      if (text) {
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          data = { error: text };
        }
      }
      if (!response.ok) {
        throw new Error(data?.error || "生成失败");
      }

      if (!data.keys) {
        throw new Error("生成失败：服务端未返回卡密");
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

      <div className="grid-two">
        <div className="field">
          <label className="label">生成数量 (1-100)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setCount("");
                return;
              }
              setCount(value.replace(/^0+(?=\d)/, ""));
            }}
            onBlur={() =>
              setCount((value) => clampNumericInput(value, 1, 100, "1"))
            }
          />
        </div>
        <div className="field">
          <label className="label">可验证次数 (1-1000)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                setMaxUses("");
                return;
              }
              setMaxUses(value.replace(/^0+(?=\d)/, ""));
            }}
            onBlur={() =>
              setMaxUses((value) => clampNumericInput(value, 1, 1000, "1"))
            }
          />
        </div>
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
          <MaskedDateInput
            className="input"
            value={expiresAt}
            onChange={setExpiresAt}
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

      {error && (
        <div className="error-list" role="status" aria-live="polite">
          {error}
        </div>
      )}

      <button
        type="button"
        className="primary-button"
        disabled={loading}
        onClick={handleGenerate}
      >
        {loading ? (
          <>
            生成中
            <span className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </>
        ) : (
          "生成卡密"
        )}
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
