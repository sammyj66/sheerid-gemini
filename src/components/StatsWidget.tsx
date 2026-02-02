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
      <div className="bento-grid">
        <div className="bento-card bento-success">
          <div className="bento-icon">✨</div>
          <div>
            <div className="bento-label">成功</div>
            <div className="bento-value">{data?.todaySuccess ?? 0}</div>
          </div>
          <div className="bento-unit">次</div>
        </div>
        <div className="bento-card bento-fail">
          <div className="bento-icon">💥</div>
          <div>
            <div className="bento-label">失败</div>
            <div className="bento-value">{data?.todayFail ?? 0}</div>
          </div>
          <div className="bento-unit">次</div>
        </div>
        <div className="bento-card bento-total">
          <div className="bento-icon">📦</div>
          <div>
            <div className="bento-label">总计</div>
            <div className="bento-value">{data?.todayTotal ?? 0}</div>
          </div>
          <div className="bento-unit">次</div>
        </div>
      </div>
    </div>
  );
}
