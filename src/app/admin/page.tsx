"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import KeyGenerator from "@/components/admin/KeyGenerator";
import KeyTable from "@/components/admin/KeyTable";
import AuditLogTable from "@/components/admin/AuditLogTable";

type Stats = {
  total: number;
  unused: number;
  locked: number;
  consumed: number;
  revoked: number;
  expired: number;
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || "加载失败");
  }
  return data as { stats?: Stats };
};

export default function AdminDashboardPage() {
  const [filters, setFilters] = useState({
    status: "ALL",
    query: "",
    page: 1,
    limit: 20,
  });
  const [statsRefreshToken, setStatsRefreshToken] = useState(0);
  const [listRefreshToken, setListRefreshToken] = useState(0);

  const statsKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", filters.status);
    params.set("q", filters.query);
    params.set("includeStats", "1");
    params.set("page", "1");
    params.set("limit", "1");
    params.set("refresh", String(statsRefreshToken));

    return `/api/admin/cardkeys?${params.toString()}`;
  }, [filters.status, filters.query, statsRefreshToken]);

  const { data: statsData } = useSWR(statsKey, fetcher);
  const stats = statsData?.stats ?? null;

  const refreshStats = () => {
    setStatsRefreshToken((prev) => prev + 1);
  };

  const refreshList = () => {
    setListRefreshToken((prev) => prev + 1);
  };

  const handleGenerated = () => {
    refreshStats();
    refreshList();
  };

  return (
    <div className="page admin-page">
      <div className="container admin-container">
        <header className="header">
          <div>
            <div className="title-row">
              <span className="title-badge">🛠️</span>
              <h1 className="title">管理员控制台</h1>
            </div>
            <div className="title-line" />
            <p className="subtitle">卡密管理、导出、审计日志一站式操作。</p>
          </div>
        </header>

        <section className="grid-two">
          <div className="card sticker-card">
            <KeyGenerator onGenerated={handleGenerated} />
          </div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">快捷统计</div>
                <div className="card-note">当前筛选条件统计</div>
              </div>
            </div>
            <div className="bento-grid">
              <div className="bento-card bento-total">
                <div className="bento-icon">📦</div>
                <div>
                  <div className="bento-label">总数</div>
                  <div className="bento-value">{stats?.total ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
              <div className="bento-card bento-success">
                <div className="bento-icon">💡</div>
                <div>
                  <div className="bento-label">未使用</div>
                  <div className="bento-value">{stats?.unused ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
              <div className="bento-card bento-warn">
                <div className="bento-icon">🔒</div>
                <div>
                  <div className="bento-label">已锁定</div>
                  <div className="bento-value">{stats?.locked ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
              <div className="bento-card bento-info">
                <div className="bento-icon">⚡</div>
                <div>
                  <div className="bento-label">已消耗</div>
                  <div className="bento-value">{stats?.consumed ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
              <div className="bento-card bento-fail">
                <div className="bento-icon">🧯</div>
                <div>
                  <div className="bento-label">已作废</div>
                  <div className="bento-value">{stats?.revoked ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
              <div className="bento-card bento-muted">
                <div className="bento-icon">🕰️</div>
                <div>
                  <div className="bento-label">已过期</div>
                  <div className="bento-value">{stats?.expired ?? 0}</div>
                </div>
                <div className="bento-unit">枚</div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">卡密列表</div>
              <div className="card-note">支持筛选、分页、作废与删除</div>
            </div>
          </div>
          <KeyTable
            filters={filters}
            onFiltersChange={setFilters}
            refreshToken={listRefreshToken}
            onUpdated={refreshStats}
          />
        </section>

        <section className="card">
          <AuditLogTable refreshToken={statsRefreshToken} />
        </section>
      </div>
    </div>
  );
}
