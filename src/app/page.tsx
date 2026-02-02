"use client";

import { useCallback, useState } from "react";
import HelpModal from "@/components/HelpModal";
import StatsWidget from "@/components/StatsWidget";
import VerificationForm, {
  VerificationFormPayload,
} from "@/components/VerificationForm";
import VerificationProgress, {
  VerificationProgressItem,
  VerificationStatus,
} from "@/components/VerificationProgress";

const completedStatuses = new Set<VerificationStatus>([
  "success",
  "fail",
  "error",
  "timeout",
  "duplicate",
]);

function mapResultStatus(status?: string): VerificationStatus {
  switch ((status || "").toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "FAIL":
      return "fail";
    case "TIMEOUT":
      return "timeout";
    case "ERROR":
      return "error";
    case "PENDING":
      return "pending";
    default:
      return "error";
  }
}

export default function Home() {
  const [items, setItems] = useState<VerificationProgressItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const updateItem = useCallback(
    (index: number, patch: Partial<VerificationProgressItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.index === index ? { ...item, ...patch } : item
        )
      );
    },
    []
  );

  const handleEvent = useCallback(
    (eventName: string, payload: Record<string, unknown>) => {
      const index = typeof payload.index === "number" ? payload.index : -1;
      if (index < 0) return;

      if (eventName === "queued") {
        updateItem(index, {
          status: "processing",
          jobId: payload.jobId as string | undefined,
          verificationId: payload.verificationId as string | undefined,
          message: "已进入队列",
        });
        return;
      }

      if (eventName === "duplicate") {
        updateItem(index, {
          status: "duplicate",
          jobId: payload.jobId as string | undefined,
          resultUrl: payload.resultUrl as string | undefined,
          verificationId: payload.verificationId as string | undefined,
          message: "已验证过，直接返回历史结果",
        });
        setRefreshToken((prev) => prev + 1);
        return;
      }

      if (eventName === "error") {
        updateItem(index, {
          status: "error",
          message: payload.message as string | undefined,
        });
        setRefreshToken((prev) => prev + 1);
        return;
      }

      if (eventName === "result") {
        const status = mapResultStatus(payload.status as string | undefined);
        updateItem(index, {
          status,
          resultUrl: payload.resultUrl as string | undefined,
          message: payload.message as string | undefined,
          verificationId: payload.verificationId as string | undefined,
        });
        if (completedStatuses.has(status)) {
          setRefreshToken((prev) => prev + 1);
        }
      }
    },
    [updateItem]
  );

  const parseSSE = useCallback(
    async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";
      let dataBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n")) {
          const newlineIndex = buffer.indexOf("\n");
          const line = buffer.slice(0, newlineIndex).trimEnd();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) {
            if (dataBuffer) {
              const data = dataBuffer.trimEnd();
              dataBuffer = "";
              let payload: Record<string, unknown> = { message: data };
              try {
                payload = JSON.parse(data);
              } catch {
                // keep raw message
              }
              handleEvent(eventName, payload);
            }
            eventName = "message";
            continue;
          }

          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            continue;
          }

          if (line.startsWith("data:")) {
            dataBuffer += line.slice(5).trimStart() + "\n";
          }
        }
      }

      if (dataBuffer) {
        const finalData = dataBuffer.trimEnd();
        let payload: Record<string, unknown> = { message: finalData };
        try {
          payload = JSON.parse(finalData);
        } catch {
          // ignore
        }
        handleEvent(eventName, payload);
      }
    },
    [handleEvent]
  );

  const handleSubmit = async (payload: VerificationFormPayload) => {
    setGlobalError(null);
    setIsSubmitting(true);

    setItems(
      payload.links.map((link, index) => ({
        index,
        link,
        cardKey: payload.cardKeys[index] ?? "",
        verificationId: payload.verificationIds[index],
        status: "processing",
        message: "等待上游响应",
      }))
    );

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          links: payload.links,
          cardKeys: payload.cardKeys,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "请求失败");
      }

      if (!response.body) {
        throw new Error("响应缺少 SSE 数据流");
      }

      await parseSSE(response.body);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "提交失败");
      setItems((prev) =>
        prev.map((item) =>
          completedStatuses.has(item.status)
            ? item
            : { ...item, status: "error", message: "网络异常" }
        )
      );
    } finally {
      setIsSubmitting(false);
      setRefreshToken((prev) => prev + 1);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">Gemini 学生认证平台</h1>
            <p className="subtitle">
              使用卡密激活 SheerID 学生验证，实时查看进度并获取验证结果。
            </p>
          </div>
          <button className="help-button" onClick={() => setHelpOpen(true)}>
            帮助
          </button>
        </header>

        <section className="card">
          <StatsWidget refreshToken={refreshToken} />
        </section>

        <section className="grid-two">
          <div className="card">
            <VerificationForm
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
            />
          </div>
          <div className="card">
            {globalError && <div className="error-list">{globalError}</div>}
            <VerificationProgress items={items} />
          </div>
        </section>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
