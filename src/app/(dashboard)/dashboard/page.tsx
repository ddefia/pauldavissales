"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Upload,
  Phone,
  Briefcase,
  Zap,
  MapPin,
  ArrowRight,
  Loader2,
  Search,
  FileText,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const TerritoryMap = dynamic(() => import("@/components/maps/territory-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-xl bg-gray-50 animate-pulse flex items-center justify-center">
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
    <div className="space-y-8 p-1">
      <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-[420px] bg-gray-100 rounded-xl animate-pulse" />
    </div>
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
      .then((d) => {
        setData(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function startBatchPreRun() {
    setPreRunning(true);
    setPreRunStatus("Starting batch enrichment...");
    try {
      setPreRunStatus("Enriching top contacts...");
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
          setPreRunStatus(
            `Enriching... ${statusData.data?.success || 0}/${statusData.data?.total || 0} done`
          );
          if (!statusData.data?.running) running = false;
        }
      }

      setPreRunStatus("Scoring contacts...");
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalContacts.toLocaleString()} people across {data.territoryBreakdown.length} territories
          </p>
        </div>
        <Button
          onClick={startBatchPreRun}
          disabled={preRunning}
          size="sm"
          className="bg-[#ED1C24] hover:bg-red-700 text-white shadow-sm"
        >
          {preRunning ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          {preRunning ? "Working..." : "Enrich & Score"}
        </Button>
      </div>

      {preRunStatus && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
          {preRunStatus}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total People */}
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">People</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.totalContacts.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">{data.totalOrganizations.toLocaleString()} companies</p>
          </CardContent>
        </Card>

        {/* Know Their Role */}
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
                <Briefcase className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Have Title</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{(data.titleCount ?? 0).toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${titlePct}%` }} />
              </div>
              <span className="text-xs text-gray-500 tabular-nums">{titlePct}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Have Phone */}
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Phone className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Have Phone</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{(data.phoneCount ?? 0).toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${phonePct}%` }} />
              </div>
              <span className="text-xs text-gray-500 tabular-nums">{phonePct}%</span>
            </div>
          </CardContent>
        </Card>

        {/* AI Briefs */}
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#C4A265] flex items-center justify-center">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">AI Briefs</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{(data.aiBriefCount ?? 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">deep research ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map */}
        <Card className="lg:col-span-2 rounded-xl shadow-sm border-0 bg-white overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Territory Map</h2>
          </div>
          <div className="px-3 pb-3">
            <TerritoryMap contacts={data.mapContacts} height={380} />
          </div>
        </Card>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Territories */}
          <Card className="rounded-xl shadow-sm border-0 bg-white">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-gray-800">Territories</h2>
            </div>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="space-y-3">
                {data.territoryBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map((t) => {
                    const pct = Math.round((t.count / data.totalContacts) * 100);
                    return (
                      <div key={t.name}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-gray-700 font-medium">{t.name}</span>
                          <span className="text-gray-500 tabular-nums text-xs">{t.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#C4A265] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {data.totalContacts - data.territoryBreakdown.reduce((s, t) => s + t.count, 0) > 0 && (
                  <p className="text-xs text-gray-400">
                    +{(data.totalContacts - data.territoryBreakdown.reduce((s, t) => s + t.count, 0)).toLocaleString()} unassigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-xl shadow-sm border-0 bg-white">
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-sm font-semibold text-gray-800">Quick Actions</h2>
            </div>
            <CardContent className="px-3 pb-3 pt-0 space-y-0.5">
              <Link href="/pre-call" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <FileText className="h-4 w-4 text-[#C4A265]" />
                </div>
                <span className="text-sm text-gray-700 font-medium flex-1">Pre-Call Reports</span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
              <Link href="/lead-finder" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Search className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium flex-1">Find New Leads</span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
              <Link href="/contacts" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium flex-1">All Contacts</span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
              <Link href="/imports/new" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <Upload className="h-4 w-4 text-orange-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium flex-1">Import Contacts</span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Leads */}
      <Card className="rounded-xl shadow-sm border-0 bg-white">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Top Leads</h2>
          <Link href="/pre-call" className="text-xs text-[#C4A265] hover:underline font-medium">
            View all →
          </Link>
        </div>
        <CardContent className="px-5 pb-5 pt-0">
          {data.topScoredContacts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No scored contacts yet. Hit &quot;Enrich &amp; Score&quot; to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.topScoredContacts.slice(0, 8).map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#C4A265] transition-colors">
                      {c.fullName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.title || "No title"}{c.organization ? ` · ${c.organization.name}` : ""}
                    </p>
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${
                    (c.compositeScore || 0) >= 70 ? "text-emerald-600" :
                    (c.compositeScore || 0) >= 40 ? "text-amber-600" : "text-gray-400"
                  }`}>
                    {c.compositeScore ?? "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Imports — compact */}
      {data.recentImports.length > 0 && (
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Recent Imports</h2>
            <Link href="/imports" className="text-xs text-[#C4A265] hover:underline font-medium">
              View all →
            </Link>
          </div>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="space-y-2">
              {data.recentImports.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{imp.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {imp.totalRows ?? "?"} rows{imp.newContacts ? ` · ${imp.newContacts} new` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={imp.status === "COMPLETED" ? "default" : imp.status === "FAILED" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0 ml-3"
                  >
                    {imp.status === "COMPLETED" ? "Done" : imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
