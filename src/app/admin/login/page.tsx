"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) setNextPath(next);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "登录失败");
      }
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card admin-login-card">
          <div className="card-header">
            <div>
              <div className="title-row">
                <span className="title-badge" aria-hidden="true">
                  <svg className="gemini-logo" viewBox="0 0 24 24" focusable="false">
                    <path d="M12 2 L22 20 L12 20 Z" fill="#7c3aed" />
                    <path d="M12 2 L12 20 L2 20 Z" fill="#22d3ee" />
                    <path d="M12 4.6 L19.4 19 H4.6 Z" fill="rgba(251, 113, 133, 0.55)" />
                  </svg>
                </span>
                <div className="card-title">管理员登录</div>
              </div>
              <div className="card-note">请输入管理员密码</div>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">管理员密码</label>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <div className="error-list" role="status" aria-live="polite">
                {error}
              </div>
            )}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  登录中
                  <span className="loading-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </>
              ) : (
                "登录"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
