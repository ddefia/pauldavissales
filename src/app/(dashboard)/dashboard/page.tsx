"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Users,
  Upload,
  Phone,
  Briefcase,
  Zap,
  MapPin,
  Loader2,
  Search,
  FileText,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Target,
  ArrowUpRight,
  Building2,
} from "lucide-react";

const TerritoryMap = dynamic(() => import("@/components/maps/territory-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-2xl bg-gray-50 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-400">Loading map...</span>
    </div>
  ),
});

interface DashboardData {
  totalContacts: number;
  totalOrganizations: number;
  totalProperties: number;
  totalImports: number;
  contactsByStatus: Record<string, number>;
  emailCoverage: number;
  phoneCoverage: number;
  validatedPct: number;
  enrichedCount: number;
  aiBriefCount: number;
  scoredCount: number;
  titleCount: number;
  phoneCount: number;
  enrichedPct: number;
  scoredPct: number;
  avgDataQuality: number;
  pendingDuplicates: number;
  recentImports: Array<{
    id: string;
    fileName: string;
    status: string;
    source: string;
    totalRows: number | null;
    newContacts: number | null;
    createdAt: string;
  }>;
  territoryBreakdown: Array<{ name: string; count: number }>;
  topScoredContacts: Array<{
    id: string;
    fullName: string;
    title: string | null;
    compositeScore: number | null;
    fitScore: number | null;
    triggerScore: number | null;
    email: string | null;
    phone: string | null;
    organization: { name: string } | null;
    territory: { name: string } | null;
  }>;
  mapContacts: Array<{
    id: string;
    fullName: string;
    city: string | null;
    territory: string | null;
    compositeScore: number | null;
    status: string;
  }>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-[420px] bg-white rounded-2xl animate-pulse" />
    </div>
  );
}

function StatRing({ value, max, color, size = 48 }: { value: number; max: number; color: string; size?: number }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-1000 ease-out" />
    </svg>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preRunning, setPreRunning] = useState(false);
  const [preRunStatus, setPreRunStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((d) => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function startBatchPreRun() {
    setPreRunning(true);
    setPreRunStatus("Starting...");
    try {
      setPreRunStatus("Researching contacts...");
      const enrichRes = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, batchSize: 20 }),
      });
      const enrichData = await enrichRes.json();
      if (enrichData.data?.running) {
        let running = true;
        while (running) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusRes = await fetch("/api/enrichment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkStatus: true }),
          });
          const statusData = await statusRes.json();
          setPreRunStatus(`Researching... ${statusData.data?.success || 0}/${statusData.data?.total || 0}`);
          if (!statusData.data?.running) running = false;
        }
      }
      setPreRunStatus("Scoring all contacts...");
      await fetch("/api/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setPreRunStatus("Done! Refreshing...");
      const res = await fetch("/api/dashboard/stats");
      const d = await res.json();
      setData(d.data);
      setPreRunStatus(null);
    } catch {
      setPreRunStatus("Something went wrong — try again");
    }
    setPreRunning(false);
  }

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const titlePct = data.totalContacts > 0 ? Math.round((data.titleCount / data.totalContacts) * 100) : 0;
  const phonePct = data.totalContacts > 0 ? Math.round((data.phoneCount / data.totalContacts) * 100) : 0;
  const scoredPct = data.totalContacts > 0 ? Math.round((data.scoredCount / data.totalContacts) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Your sales intelligence at a glance
          </p>
        </div>
        <Button
          onClick={startBatchPreRun}
          disabled={preRunning}
          size="sm"
          className="bg-[#1a1a1a] hover:bg-black text-white rounded-full px-5 h-9 text-xs font-medium shadow-sm"
        >
          {preRunning ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {preRunning ? "Working..." : "Run AI Research"}
        </Button>
      </div>

      {preRunStatus && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
          {preRunStatus}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total People */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs text-gray-400 font-medium">{data.totalOrganizations} companies</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{data.totalContacts.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Contacts</p>
        </div>

        {/* Know Their Title */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div className="relative">
              <StatRing value={data.titleCount} max={data.totalContacts} color="#8b5cf6" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-violet-600">{titlePct}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{data.titleCount.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Know Their Job Title</p>
        </div>

        {/* Have Phone */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Phone className="h-5 w-5 text-white" />
            </div>
            <div className="relative">
              <StatRing value={data.phoneCount} max={data.totalContacts} color="#10b981" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-600">{phonePct}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{data.phoneCount.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Have Phone Number</p>
        </div>

        {/* AI Researched */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#C4A265] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="relative">
              <StatRing value={data.aiBriefCount} max={data.totalContacts} color="#C4A265" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#C4A265]">{data.totalContacts > 0 ? Math.round((data.aiBriefCount / data.totalContacts) * 100) : 0}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{(data.aiBriefCount ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">AI Researched</p>
        </div>
      </div>

      {/* Map + Right Column */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#C4A265]" />
              <h2 className="text-sm font-semibold text-gray-800">Your Territory</h2>
            </div>
            <span className="text-xs text-gray-400">{data.territoryBreakdown.length} counties</span>
          </div>
          <div className="px-3 pb-3">
            <TerritoryMap contacts={data.mapContacts} height={380} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Territory Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Contacts by County</h2>
            <div className="space-y-3">
              {data.territoryBreakdown
                .sort((a, b) => b.count - a.count)
                .map((t) => {
                  const pct = Math.round((t.count / data.totalContacts) * 100);
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium text-xs">{t.name}</span>
                        <span className="text-gray-400 tabular-nums text-xs">{t.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#C4A265] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              {data.totalContacts - data.territoryBreakdown.reduce((s, t) => s + t.count, 0) > 0 && (
                <p className="text-[11px] text-gray-400">
                  +{(data.totalContacts - data.territoryBreakdown.reduce((s, t) => s + t.count, 0)).toLocaleString()} unassigned
                </p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h2>
            <div className="space-y-1">
              {[
                { href: "/pre-call", label: "Pre-Call Reports", icon: Zap, desc: "Prep before calling", color: "bg-amber-50 text-amber-600" },
                { href: "/lead-finder", label: "Find New Leads", icon: Search, desc: "AI-powered search", color: "bg-blue-50 text-blue-600" },
                { href: "/contacts", label: "All Contacts", icon: Users, desc: "Browse everyone", color: "bg-gray-100 text-gray-600" },
                { href: "/imports/new", label: "Import CSV", icon: Upload, desc: "Add more contacts", color: "bg-orange-50 text-orange-600" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center transition-colors`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 font-medium block">{item.label}</span>
                    <span className="text-[11px] text-gray-400">{item.desc}</span>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#C4A265] transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Leads */}
      {data.topScoredContacts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#C4A265]" />
              <h2 className="text-sm font-semibold text-gray-800">Hottest Leads</h2>
            </div>
            <Link href="/pre-call" className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {data.topScoredContacts.slice(0, 8).map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    idx < 3 ? "bg-[#C4A265]/10 text-[#C4A265]" : "bg-gray-100 text-gray-400"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#C4A265] transition-colors">
                      {c.fullName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {c.title || "Unknown role"}{c.organization ? ` · ${c.organization.name}` : ""}
                    </p>
                  </div>
                  <div className={`text-base font-bold tabular-nums px-2 py-0.5 rounded-lg ${
                    (c.compositeScore || 0) >= 70 ? "bg-emerald-50 text-emerald-600" :
                    (c.compositeScore || 0) >= 40 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"
                  }`}>
                    {c.compositeScore ?? "—"}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Imports — compact */}
      {data.recentImports.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Recent Imports</h2>
            </div>
            <Link href="/imports" className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-2">
              {data.recentImports.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{imp.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {imp.totalRows ?? "?"} rows{imp.newContacts ? ` · ${imp.newContacts} new` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    imp.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" :
                    imp.status === "FAILED" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {imp.status === "COMPLETED" ? "Done" : imp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
