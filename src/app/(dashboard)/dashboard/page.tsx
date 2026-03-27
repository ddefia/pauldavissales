"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  ChevronRight,
  Sparkles,
  PhoneCall,
  TrendingUp,
  Target,
  CalendarCheck,
  Voicemail,
  FileText,
  Handshake,
  Plus,
  Minus,
  Check,
  Newspaper,
  ExternalLink,
  RefreshCw,
  CloudRain,
  Shield,
  Home,
} from "lucide-react";

interface CallListContact {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  phoneMobile: string | null;
  city: string | null;
  orgName: string | null;
  territory: string | null;
  why: string;
  hasEnrichment: boolean;
}

interface WeeklyPlan {
  id: string;
  weekNumber: number;
  label: string;
  status: string;
  weekStart: string;
  targetCalls: number;
  targetEmails: number;
  targetVoicemails: number;
  targetMeetings: number;
  targetPdfs: number;
  actualCalls: number;
  actualEmails: number;
  actualVoicemails: number;
  actualMeetings: number;
  actualPdfs: number;
  notes: string | null;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet: string;
  category: string;
}

interface DashboardData {
  totalContacts: number;
  totalOrganizations: number;
  callList: CallListContact[];
  weeklyPlan: WeeklyPlan | null;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 max-w-[1100px] mx-auto pt-4">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="col-span-2 h-[400px] bg-white rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

// ─── Weekly Tracker Component ────────────────────────────────────────────────

function WeeklyTracker({
  plan,
  onUpdate,
}: {
  plan: WeeklyPlan;
  onUpdate: (field: string, value: number) => void;
}) {
  const metrics = [
    {
      key: "actualCalls",
      label: "Calls",
      target: plan.targetCalls,
      actual: plan.actualCalls,
      icon: PhoneCall,
      color: "emerald",
    },
    {
      key: "actualEmails",
      label: "Emails",
      target: plan.targetEmails,
      actual: plan.actualEmails,
      icon: Mail,
      color: "blue",
    },
    {
      key: "actualVoicemails",
      label: "VMs",
      target: plan.targetVoicemails,
      actual: plan.actualVoicemails,
      icon: Voicemail,
      color: "amber",
    },
    {
      key: "actualMeetings",
      label: "Meetings",
      target: plan.targetMeetings,
      actual: plan.actualMeetings,
      icon: Handshake,
      color: "red",
    },
    {
      key: "actualPdfs",
      label: "PDFs",
      target: plan.targetPdfs,
      actual: plan.actualPdfs,
      icon: FileText,
      color: "purple",
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200", bar: "bg-emerald-500" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200", bar: "bg-blue-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200", bar: "bg-amber-500" },
    red: { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200", bar: "bg-red-500" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-200", bar: "bg-purple-500" },
  };

  const weekStart = new Date(plan.weekStart);
  const now = new Date();
  const dayOfWeek = Math.min(5, Math.max(1, Math.ceil((now.getTime() - weekStart.getTime()) / 86400000)));
  const daysLeft = Math.max(0, 5 - dayOfWeek);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#C4A265]" />
            <h2 className="text-sm font-semibold text-gray-800">{plan.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            {daysLeft > 0 ? (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                {daysLeft}d left
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Week complete
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {metrics.map((m) => {
          const pct = m.target > 0 ? Math.min(100, Math.round((m.actual / m.target) * 100)) : 0;
          const colors = colorMap[m.color];
          const Icon = m.icon;
          const hit = m.actual >= m.target;

          return (
            <div key={m.key} className="group">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{m.label}</span>
                    <div className="flex items-center gap-1.5">
                      {hit && <Check className="h-3 w-3 text-emerald-500" />}
                      <span className="text-xs tabular-nums text-gray-500">
                        <span className={hit ? "text-emerald-600 font-bold" : "font-semibold text-gray-900"}>{m.actual}</span>
                        <span className="text-gray-300">/{m.target}</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onUpdate(m.key, Math.max(0, m.actual - 1))}
                    className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <Minus className="h-2.5 w-2.5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => onUpdate(m.key, m.actual + 1)}
                    className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-50">
        {(() => {
          const totalTarget = plan.targetCalls + plan.targetEmails + plan.targetVoicemails + plan.targetMeetings + plan.targetPdfs;
          const totalActual = plan.actualCalls + plan.actualEmails + plan.actualVoicemails + plan.actualMeetings + plan.actualPdfs;
          const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
          return (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Week progress</span>
              <span className="text-xs font-bold text-[#C4A265]">{overallPct}%</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── No Plan State ───────────────────────────────────────────────────────────

function NoWeeklyPlan({ onCreated }: { onCreated: () => void }) {
  const [creating, setCreating] = useState(false);

  const createWeek1 = async () => {
    setCreating(true);
    try {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: 1,
          weekStart: monday.toISOString(),
          label: "Week 1 — 50 Personalized Touches",
          targetCalls: 50,
          targetEmails: 50,
          targetVoicemails: 100,
          targetMeetings: 5,
          targetPdfs: 50,
        }),
      });
      onCreated();
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-[#C4A265]" />
        <h2 className="text-sm font-semibold text-gray-800">Weekly Plan</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Track your outreach targets and progress. Start your first week.
      </p>
      <button
        onClick={createWeek1}
        disabled={creating}
        className="w-full text-xs font-semibold text-white bg-[#222] hover:bg-[#333] rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
      >
        {creating ? "Setting up..." : "Start Week 1"}
      </button>
    </div>
  );
}

// ─── Market Intel / News Feed ─────────────────────────────────────────────────

const categoryMeta: Record<string, { icon: typeof CloudRain; color: string; bg: string }> = {
  "Storm & Flooding": { icon: CloudRain, color: "text-blue-500", bg: "bg-blue-50" },
  "Insurance & Restoration": { icon: Shield, color: "text-amber-500", bg: "bg-amber-50" },
  "Property Damage": { icon: Home, color: "text-red-500", bg: "bg-red-50" },
};

function MarketIntel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/dashboard/news");
      const json = await res.json();
      setNews(json.data || []);
      setFetchedAt(json.fetchedAt);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    return "just now";
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-[#C4A265]" />
          <h2 className="text-sm font-semibold text-gray-800">Market Intel</h2>
          <span className="text-[10px] text-gray-300 font-medium">South Florida</span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          title="Refresh news"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-50 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-gray-400">No news available right now.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {news.map((item, i) => {
            const meta = categoryMeta[item.category] || categoryMeta["Property Damage"];
            const Icon = meta.icon;
            return (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 group-hover:text-[#C4A265] transition-colors leading-snug">
                    {item.title}
                  </p>
                  {item.snippet && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{item.snippet}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium text-gray-400">{item.source}</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-[10px] text-gray-300">{timeAgo(item.publishedAt)}</span>
                    <span className="text-gray-200">·</span>
                    <span className={`text-[10px] font-medium ${meta.color}`}>{item.category}</span>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-gray-200 group-hover:text-[#C4A265] shrink-0 mt-1 transition-colors" />
              </a>
            );
          })}
        </div>
      )}

      {fetchedAt && !loading && (
        <div className="px-5 py-2.5 bg-gray-50/50 border-t border-gray-50">
          <p className="text-[10px] text-gray-300">Updated {timeAgo(fetchedAt)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((d) => {
        setData(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateMetric = async (field: string, value: number) => {
    if (!data?.weeklyPlan) return;

    setData((prev) =>
      prev
        ? {
            ...prev,
            weeklyPlan: prev.weeklyPlan
              ? { ...prev.weeklyPlan, [field]: value }
              : null,
          }
        : null
    );

    await fetch("/api/weekly-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 pt-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Your top {data.callList.length} leads, ready to go
        </p>
      </div>

      {/* Main: Call List + Right Column */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Call List — 3 cols */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                Today&apos;s Call List
              </h2>
              <Link
                href="/contacts"
                className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-0.5"
              >
                All contacts <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {data.callList.map((contact, i) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
                >
                  <span className="text-xs font-bold text-gray-300 w-4 pt-1 shrink-0 text-right tabular-nums">
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#C4A265] transition-colors">
                        {contact.fullName}
                      </p>
                      {contact.hasEnrichment && (
                        <span title="AI researched">
                          <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {contact.title || ""}
                      {contact.title && contact.orgName ? " · " : ""}
                      {contact.orgName || ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {contact.why}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-1">
                    {(contact.phone || contact.phoneMobile) && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600">
                        <Phone className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Call</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
                        <Mail className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Email</span>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-[#C4A265] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Weekly Plan + Market Intel */}
        <div className="lg:col-span-2 space-y-4">
          {data.weeklyPlan ? (
            <WeeklyTracker plan={data.weeklyPlan} onUpdate={handleUpdateMetric} />
          ) : (
            <NoWeeklyPlan onCreated={loadData} />
          )}

          <MarketIntel />
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
