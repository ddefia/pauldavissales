"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Briefcase,
  AlertTriangle,
  Clock,
  Upload,
  ArrowRight,
} from "lucide-react";
import { fmtCurrency, fmtPct, fmtDate } from "@/modules/jobs/format";

interface DashboardData {
  openCount: number;
  committedTotal: number;
  currentTotal: number;
  variance: number;
  variancePct: number | null;
  cashFlow: { month: string; label: string; amount: number }[];
  byStatus: { status: string; count: number }[];
  byPm: { pm: string; count: number; currentTotal: number }[];
  byOffice: { office: string; count: number; currentTotal: number }[];
  alerts: {
    pastDue: { id: string; jobNumber: string; customerName: string | null; pm: string | null; targetCompletionDate: string }[];
    drift: { id: string; jobNumber: string; customerName: string | null; pm: string | null; variance: number }[];
  };
}

export default function JobsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (!data || data.openCount === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#F26522]/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-[#F26522]" />
        </div>
        <h2 className="text-base font-semibold text-gray-800">No open jobs yet</h2>
        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
          Upload your RMS open-jobs export to populate the dashboard. Each upload
          is an upsert — your manual commitments are never overwritten.
        </p>
        <Link
          href="/jobs/settings"
          className="inline-flex items-center gap-2 mt-5 text-xs font-semibold text-white bg-[#F26522] hover:bg-[#d9551a] rounded-lg px-4 py-2.5 transition-colors shadow-sm shadow-[#F26522]/30"
        >
          <Upload className="h-3.5 w-3.5" /> Upload RMS export
        </Link>
      </div>
    );
  }

  const maxCash = Math.max(1, ...data.cashFlow.map((c) => c.amount));
  const cashTotal = data.cashFlow.reduce((s, c) => s + c.amount, 0);
  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count));
  const alertCount = data.alerts.pastDue.length + data.alerts.drift.length;

  return (
    <div className="space-y-5">
      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Open jobs"
          value={String(data.openCount)}
          tint="text-gray-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Committed estimate"
          value={fmtCurrency(data.committedTotal, true)}
          tint="text-gray-700"
        />
        <StatCard
          icon={Wallet}
          label="Current estimate"
          value={fmtCurrency(data.currentTotal, true)}
          tint="text-gray-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Aggregate variance"
          value={fmtCurrency(data.variance, true)}
          sub={fmtPct(data.variancePct)}
          tint={data.variance < 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Cash-flow forecast — headline */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#F26522]" />
              <h2 className="text-sm font-semibold text-gray-800">Cash-flow forecast</h2>
              <span className="text-[10px] text-gray-300 font-medium">
                forecast billing, by month
              </span>
            </div>
            {data.cashFlow.length > 0 && (
              <div className="text-right leading-none">
                <div className="text-lg font-bold text-gray-900 tabular-nums">
                  {fmtCurrency(cashTotal, true)}
                </div>
                <div className="text-[10px] text-gray-400">forecast total</div>
              </div>
            )}
          </div>
          <div className="p-5">
            {data.cashFlow.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">
                No billing forecasts entered yet. Add a 3-month forecast on each
                job in Open Jobs to build this view.
              </p>
            ) : (
              <div className="flex items-end gap-3 h-48">
                {data.cashFlow.map((c) => (
                  <div key={c.month} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                    <span className="text-[11px] font-semibold text-gray-700 tabular-nums">
                      {fmtCurrency(c.amount, true)}
                    </span>
                    <div className="w-full flex items-end justify-center h-full">
                      <div
                        className="w-full max-w-[56px] bg-gradient-to-t from-[#F26522] to-[#FB8B4C] rounded-t-md transition-all"
                        style={{ height: `${Math.max(4, (c.amount / maxCash) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{c.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Jobs by status */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#F26522]" />
            <h2 className="text-sm font-semibold text-gray-800"># of jobs by status</h2>
          </div>
          <div className="p-5 space-y-2.5">
            {data.byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 truncate" title={s.status}>
                  {s.status}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1a1a1a] rounded-full"
                    style={{ width: `${(s.count / maxStatus) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-6 text-right tabular-nums">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${alertCount > 0 ? "text-amber-500" : "text-gray-300"}`} />
          <h2 className="text-sm font-semibold text-gray-800">Alerts</h2>
          <span className="text-[10px] text-gray-300 font-medium">
            past target date · estimate drift &gt; 5%
          </span>
        </div>
        {alertCount === 0 ? (
          <p className="text-xs text-gray-400 px-5 py-6">Nothing flagged. Every open job is on track.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-50">
            <AlertList
              title="Past target completion date"
              icon={Clock}
              items={data.alerts.pastDue.map((a) => ({
                id: a.id,
                primary: a.customerName || a.jobNumber,
                secondary: `${a.pm || "—"} · due ${fmtDate(a.targetCompletionDate)}`,
              }))}
            />
            <AlertList
              title="Estimate drift"
              icon={TrendingUp}
              items={data.alerts.drift.map((a) => ({
                id: a.id,
                primary: a.customerName || a.jobNumber,
                secondary: `${a.pm || "—"} · ${fmtCurrency(a.variance, true)}`,
              }))}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Link
          href="/jobs/open"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F26522] hover:underline"
        >
          Go to Open Jobs <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  sub?: string;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-[#F26522]/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-[#F26522]" />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${tint}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

function AlertList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Clock;
  items: { id: string; primary: string; secondary: string }[];
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-[10px] text-gray-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-300 pl-5">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((it) => (
            <li key={it.id} className="pl-5">
              <p className="text-xs font-medium text-gray-800 truncate">{it.primary}</p>
              <p className="text-[11px] text-gray-400 truncate">{it.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
