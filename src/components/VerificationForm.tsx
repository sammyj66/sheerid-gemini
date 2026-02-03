"use client";

import { useMemo, useState, useEffect } from "react";
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
  const [pairMode, setPairMode] = useState<"oneToOne" | "oneToMany">("oneToOne");
  const [linksText, setLinksText] = useState("");
  const [keysText, setKeysText] = useState("");
  const [touched, setTouched] = useState(false);
  const [remainingUses, setRemainingUses] = useState<number | null>(null);
  const [cardKeyLoading, setCardKeyLoading] = useState(false);

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
      pairMode === "oneToOne"
        ? links.length > 0 && cardKeys.length > 0 && links.length !== cardKeys.length
        : cardKeys.length !== 1 || links.length === 0;

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
  }, [linksText, keysText, pairMode]);

  useEffect(() => {
    if (pairMode !== "oneToMany") {
      setRemainingUses(null);
      return;
    }
    const cardKeys = parseLines(keysText);
    if (cardKeys.length !== 1) {
      setRemainingUses(null);
      return;
    }
    let isActive = true;
    const controller = new AbortController();

    const fetchRemaining = async () => {
      setCardKeyLoading(true);
      try {
        const response = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardKey: cardKeys[0] }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!isActive) return;
        if (!response.ok || !data?.found) {
          setRemainingUses(null);
          return;
        }
        const remaining =
          typeof data.remainingUses === "number"
            ? data.remainingUses
            : typeof data.maxUses === "number" && typeof data.usedCount === "number"
              ? data.maxUses - data.usedCount
              : null;
        setRemainingUses(remaining);
      } catch {
        if (isActive) {
          setRemainingUses(null);
        }
      } finally {
        if (isActive) {
          setCardKeyLoading(false);
        }
      }
    };

    fetchRemaining();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [keysText, pairMode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!validation.canSubmit) return;
    await onSubmit({
      links: validation.links,
      cardKeys:
        pairMode === "oneToMany"
          ? Array(validation.links.length).fill(validation.cardKeys[0])
          : validation.cardKeys,
      verificationIds: validation.verificationIds,
    });
  };

  const helperText =
    pairMode === "oneToMany"
      ? "一卡多链模式：输入一张多次使用的卡密，可验证多个链接"
      : mode === "single"
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
        <label className="label">配对模式</label>
        <div
          className={`mode-toggle ${pairMode === "oneToOne" ? "single" : "batch"}`}
          role="tablist"
        >
          <span className="mode-slider" />
          <button
            type="button"
            className={`mode-button ${pairMode === "oneToOne" ? "active" : ""}`}
            aria-pressed={pairMode === "oneToOne"}
            onClick={() => setPairMode("oneToOne")}
          >
            一卡一链
          </button>
          <button
            type="button"
            className={`mode-button ${pairMode === "oneToMany" ? "active" : ""}`}
            aria-pressed={pairMode === "oneToMany"}
            onClick={() => setPairMode("oneToMany")}
          >
            一卡多链
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
          placeholder={
            pairMode === "oneToMany"
              ? "一卡多链模式下仅需填写一条卡密"
              : "粘贴卡密，多条请换行"
          }
          value={keysText}
          onChange={(event) => setKeysText(normalizeInput(event.target.value))}
          rows={mode === "single" ? 3 : 6}
        />
        <div className="helper">已识别 {validation.cardKeys.length} 条卡密</div>
        {pairMode === "oneToMany" && validation.cardKeys.length === 1 && (
          <div className="helper">
            {cardKeyLoading
              ? "正在查询卡密剩余次数..."
              : remainingUses !== null
                ? `该卡密还可验证 ${remainingUses} 次`
                : "未查询到卡密剩余次数"}
          </div>
        )}
        {pairMode === "oneToMany" &&
          remainingUses !== null &&
          validation.links.length > 0 &&
          remainingUses < validation.links.length && (
            <div className="error-list" role="status" aria-live="polite">
              当前卡密剩余次数不足，最多可验证 {remainingUses} 条链接
            </div>
          )}
      </div>

      {(validation.issues.length > 0 || validation.countMismatch) && (
        <div className="error-list" role="status" aria-live="polite">
          {validation.countMismatch && (
            <div>
              {pairMode === "oneToMany"
                ? "一卡多链模式需要 1 条卡密 + 至少 1 条链接"
                : "链接数量必须与卡密数量一致"}
            </div>
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
