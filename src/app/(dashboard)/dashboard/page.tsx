"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Users,
  MapPin,
  Search,
  Zap,
  ChevronRight,
  ArrowUpRight,
  Fish,
  Building2,
  Phone,
  Mail,
  Crown,
  Target,
  Anchor,
} from "lucide-react";

const TerritoryMap = dynamic(() => import("@/components/maps/territory-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-2xl bg-gray-50/50 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-300">Loading map...</span>
    </div>
  ),
});

interface Contact {
  id: string;
  fullName: string;
  title: string | null;
  compositeScore: number | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  organization: { name: string } | null;
  territory: { name: string } | null;
}

interface DashboardData {
  totalContacts: number;
  totalOrganizations: number;
  bigFish: Contact[];
  mediumFish: Contact[];
  worthACall: Contact[];
  bigFishCount: number;
  mediumFishCount: number;
  worthACallCount: number;
  territoryBreakdown: Array<{ name: string; count: number }>;
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
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-[500px] bg-white rounded-2xl animate-pulse" />
    </div>
  );
}

function ContactRow({ contact, tier }: { contact: Contact; tier: "big" | "medium" | "small" }) {
  const tierColors = {
    big: "bg-amber-400 text-amber-900",
    medium: "bg-sky-100 text-sky-700",
    small: "bg-gray-100 text-gray-500",
  };

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group border-b border-gray-50 last:border-0"
    >
      {/* Score badge */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${tierColors[tier]}`}>
        {contact.compositeScore ?? "—"}
      </div>

      {/* Name & details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#C4A265] transition-colors">
          {contact.fullName}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {contact.title || "Unknown role"}
          {contact.organization ? ` · ${contact.organization.name}` : ""}
        </p>
      </div>

      {/* Contact icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {contact.phone && (
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center" title={contact.phone}>
            <Phone className="h-3 w-3 text-emerald-500" />
          </div>
        )}
        {contact.email && (
          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center" title={contact.email}>
            <Mail className="h-3 w-3 text-blue-500" />
          </div>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-[#C4A265] transition-colors shrink-0" />
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((d) => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Good {getGreeting()}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data.totalContacts.toLocaleString()} contacts · {data.totalOrganizations.toLocaleString()} companies · {data.territoryBreakdown.length} counties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/lead-finder"
            className="flex items-center gap-2 px-4 h-9 text-xs font-medium bg-white border border-gray-200 rounded-full hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Find New Leads
          </Link>
          <Link
            href="/pre-call"
            className="flex items-center gap-2 px-4 h-9 text-xs font-medium bg-[#1a1a1a] rounded-full text-white hover:bg-black transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-[#C4A265]" />
            Pre-Call Reports
          </Link>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Big Fish</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.bigFishCount.toLocaleString()}</p>
          <p className="text-xs text-amber-600/70 mt-1">Score 60+ · High-value targets</p>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-5 border border-sky-100">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-sky-500" />
            <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Solid Prospects</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.mediumFishCount.toLocaleString()}</p>
          <p className="text-xs text-sky-600/70 mt-1">Score 35–59 · Good potential</p>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Anchor className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Worth a Call</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.worthACallCount.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Score 15–34 · Have a title</p>
        </div>
      </div>

      {/* Main Content: Leads + Map */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Lead Lists — takes 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          {/* Big Fish */}
          {data.bigFish.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-gray-800">Big Fish</h2>
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">{data.bigFishCount}</span>
                </div>
                <Link href="/contacts?sort=score&dir=desc&minScore=60" className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-0.5">
                  See all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                {data.bigFish.slice(0, 8).map((c) => (
                  <ContactRow key={c.id} contact={c} tier="big" />
                ))}
              </div>
            </div>
          )}

          {/* Solid Prospects */}
          {data.mediumFish.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-sky-500" />
                  <h2 className="text-sm font-semibold text-gray-800">Solid Prospects</h2>
                  <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full font-medium">{data.mediumFishCount}</span>
                </div>
                <Link href="/contacts?sort=score&dir=desc&minScore=35&maxScore=59" className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-0.5">
                  See all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                {data.mediumFish.slice(0, 5).map((c) => (
                  <ContactRow key={c.id} contact={c} tier="medium" />
                ))}
              </div>
            </div>
          )}

          {/* Worth a Call */}
          {data.worthACall.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Anchor className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-800">Worth a Call</h2>
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{data.worthACallCount}</span>
                </div>
                <Link href="/contacts?sort=score&dir=desc&minScore=15&maxScore=34" className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-0.5">
                  See all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                {data.worthACall.slice(0, 5).map((c) => (
                  <ContactRow key={c.id} contact={c} tier="small" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Map + Territory */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#C4A265]" />
              <h2 className="text-sm font-semibold text-gray-800">Your Territory</h2>
            </div>
            <div className="px-2 pb-2">
              <TerritoryMap contacts={data.mapContacts} height={320} />
            </div>
          </div>

          {/* Territory Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">By County</h2>
            <div className="space-y-3">
              {data.territoryBreakdown
                .sort((a, b) => b.count - a.count)
                .map((t) => {
                  const pct = Math.round((t.count / data.totalContacts) * 100);
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{t.name}</span>
                        <span className="text-xs text-gray-400 tabular-nums">{t.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#C4A265] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Quick Nav */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/contacts", label: "All Contacts", icon: Users, color: "text-gray-600" },
                { href: "/pre-call", label: "Pre-Call Prep", icon: Zap, color: "text-amber-600" },
                { href: "/lead-finder", label: "Lead Finder", icon: Search, color: "text-blue-600" },
                { href: "/organizations", label: "Companies", icon: Building2, color: "text-purple-600" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
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
