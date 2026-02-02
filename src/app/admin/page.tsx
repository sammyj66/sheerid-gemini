"use client";

import { useCallback, useEffect, useState } from "react";
import KeyGenerator from "@/components/admin/KeyGenerator";
import KeyTable from "@/components/admin/KeyTable";
import KeyExport from "@/components/admin/KeyExport";
import AuditLogTable from "@/components/admin/AuditLogTable";

type Stats = {
  total: number;
  unused: number;
  locked: number;
  consumed: number;
  revoked: number;
  expired: number;
};

export default function AdminDashboardPage() {
  const [filters, setFilters] = useState({
    status: "ALL",
    query: "",
    page: 1,
    limit: 20,
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", filters.status);
    params.set("q", filters.query);
    params.set("includeStats", "1");
    params.set("page", "1");
    params.set("limit", "1");

    const response = await fetch(`/api/admin/cardkeys?${params.toString()}`, {
      credentials: "include",
    });
    const data = await response.json();
    if (response.ok) {
      setStats(data.stats);
    }
  }, [filters.status, filters.query]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshToken]);

  const handleUpdated = () => {
    setRefreshToken((prev) => prev + 1);
  };

  return (
    <div className="page admin-page">
      <div className="container admin-container">
        <header className="header">
          <div>
            <h1 className="title">管理员控制台</h1>
            <p className="subtitle">卡密管理、导出、审计日志一站式操作。</p>
          </div>
        </header>

        <section className="grid-two">
          <div className="card">
            <KeyGenerator onGenerated={handleUpdated} />
          </div>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">快捷统计</div>
                <div className="card-note">当前筛选条件统计</div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-label">总数</div>
                <div className="stat-value">{stats?.total ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">未使用</div>
                <div className="stat-value">{stats?.unused ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">已锁定</div>
                <div className="stat-value">{stats?.locked ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">已消耗</div>
                <div className="stat-value">{stats?.consumed ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">已作废</div>
                <div className="stat-value">{stats?.revoked ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">已过期</div>
                <div className="stat-value">{stats?.expired ?? 0}</div>
              </div>
            </div>
            <div className="toolbar">
              <KeyExport status={filters.status} query={filters.query} />
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
            refreshToken={refreshToken}
            onUpdated={handleUpdated}
          />
        </section>

        <section className="card">
          <AuditLogTable refreshToken={refreshToken} />
        </section>
      </div>
    </div>
  );
}
