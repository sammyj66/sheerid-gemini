"use client";

import useSWR from "swr";
import { useEffect } from "react";

type StatsWidgetProps = {
  refreshToken?: number;
};

type StatsResponse = {
  todaySuccess: number;
  todayFail: number;
  todayTotal: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function StatsWidget({ refreshToken }: StatsWidgetProps) {
  const { data, mutate } = useSWR<StatsResponse>("/api/stats", fetcher, {
    refreshInterval: 30_000,
  });

  useEffect(() => {
    if (refreshToken !== undefined) {
      mutate();
    }
  }, [refreshToken, mutate]);

  return (
    <div>
      <div className="card-header">
        <div>
          <div className="card-title">今日统计</div>
          <div className="card-note">每 30 秒自动刷新</div>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">成功</div>
          <div className="stat-value">{data?.todaySuccess ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">失败</div>
          <div className="stat-value">{data?.todayFail ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">总计</div>
          <div className="stat-value">{data?.todayTotal ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
