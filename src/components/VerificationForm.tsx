"use client";

import { useMemo, useState } from "react";
import { extractVerificationId, validateVerificationId } from "@/lib/validation";

export type VerificationFormPayload = {
  links: string[];
  cardKeys: string[];
  verificationIds: string[];
};

type VerificationFormProps = {
  isSubmitting: boolean;
  onSubmit: (payload: VerificationFormPayload) => Promise<void> | void;
};

type LineIssue = {
  index: number;
  message: string;
};

function normalizeInput(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[，,]+/g, "\n");
}

function parseLines(value: string) {
  return normalizeInput(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function VerificationForm({
  isSubmitting,
  onSubmit,
}: VerificationFormProps) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [linksText, setLinksText] = useState("");
  const [keysText, setKeysText] = useState("");
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => {
    const links = parseLines(linksText);
    const cardKeys = parseLines(keysText);
    const issues: LineIssue[] = [];
    const verificationIds: string[] = [];

    links.forEach((link, index) => {
      const verificationId = extractVerificationId(link);
      if (!verificationId) {
        issues.push({ index, message: "无法解析 verificationId" });
        return;
      }
      const error = validateVerificationId(verificationId);
      if (error) {
        issues.push({ index, message: error });
        return;
      }
      verificationIds.push(verificationId);
    });

    const countMismatch =
      links.length > 0 && cardKeys.length > 0 && links.length !== cardKeys.length;

    return {
      links,
      cardKeys,
      verificationIds,
      issues,
      countMismatch,
      canSubmit:
        links.length > 0 &&
        cardKeys.length > 0 &&
        !countMismatch &&
        issues.length === 0,
    };
  }, [linksText, keysText]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!validation.canSubmit) return;
    await onSubmit({
      links: validation.links,
      cardKeys: validation.cardKeys,
      verificationIds: validation.verificationIds,
    });
  };

  const helperText =
    mode === "single"
      ? "单条模式下仅需填写一条链接和一条卡密"
      : "批量模式支持多行，一行一个链接/卡密";

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="card-header">
        <div>
          <div className="card-title">提交验证</div>
          <div className="card-note">{helperText}</div>
        </div>
        <div className={`mode-toggle ${mode}`} role="tablist">
          <span className="mode-slider" />
          <button
            type="button"
            className={`mode-button ${mode === "single" ? "active" : ""}`}
            aria-pressed={mode === "single"}
            onClick={() => setMode("single")}
          >
            单条
          </button>
          <button
            type="button"
            className={`mode-button ${mode === "batch" ? "active" : ""}`}
            aria-pressed={mode === "batch"}
            onClick={() => setMode("batch")}
          >
            批量
          </button>
        </div>
      </div>

      <div className="field">
        <label className="label">SheerID 链接</label>
        <textarea
          className="textarea"
          placeholder="粘贴 SheerID 验证链接，多条请换行"
          value={linksText}
          onChange={(event) => setLinksText(normalizeInput(event.target.value))}
          rows={mode === "single" ? 3 : 6}
        />
        <div className="helper">
          已识别 {validation.links.length} 条链接
        </div>
      </div>

      <div className="field">
        <label className="label">卡密</label>
        <textarea
          className="textarea"
          placeholder="粘贴卡密，多条请换行"
          value={keysText}
          onChange={(event) => setKeysText(normalizeInput(event.target.value))}
          rows={mode === "single" ? 3 : 6}
        />
        <div className="helper">已识别 {validation.cardKeys.length} 条卡密</div>
      </div>

      {(validation.issues.length > 0 || validation.countMismatch) && (
        <div className="error-list" role="status" aria-live="polite">
          {validation.countMismatch && (
            <div>链接数量必须与卡密数量一致</div>
          )}
          {(touched || validation.issues.length > 0) &&
            validation.issues.map((issue) => (
              <div key={`${issue.index}-${issue.message}`}>
                第 {issue.index + 1} 条：{issue.message}
              </div>
            ))}
        </div>
      )}

      <button
        className="primary-button"
        type="submit"
        disabled={!validation.canSubmit || isSubmitting}
      >
        {isSubmitting ? (
          <>
            验证进行中
            <span className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </>
        ) : (
          "开始验证"
        )}
      </button>
    </form>
  );
}
