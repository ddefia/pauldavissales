"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Phone,
  Mail,
  ChevronRight,
  MapPin,
  Sparkles,
  PhoneCall,
  UserCheck,
  TrendingUp,
} from "lucide-react";

const TerritoryMap = dynamic(() => import("@/components/maps/territory-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-2xl bg-gray-50/50 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-300">Loading map...</span>
    </div>
  ),
});

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

interface DashboardData {
  totalContacts: number;
  totalOrganizations: number;
  callList: CallListContact[];
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
    <div className="space-y-5 max-w-[1100px] mx-auto pt-4">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((d) => {
        setData(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const withPhone = data.callList.filter((c) => c.phone || c.phoneMobile).length;
  const withResearch = data.callList.filter((c) => c.hasEnrichment).length;

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

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <PhoneCall className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{withPhone}</p>
            <p className="text-xs text-gray-400">Ready to call</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{withResearch}</p>
            <p className="text-xs text-gray-400">AI researched</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {data.totalContacts.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">Total contacts</p>
          </div>
        </div>
      </div>

      {/* Main: Call List + Map */}
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
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-300 w-4 pt-1 shrink-0 text-right tabular-nums">
                    {i + 1}
                  </span>

                  {/* Info */}
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

                  {/* Contact methods */}
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

        {/* Right column — Map + Territory */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#C4A265]" />
                <h2 className="text-sm font-semibold text-gray-800">
                  Your Territory
                </h2>
              </div>
              <Link
                href="/map"
                className="text-xs text-[#C4A265] hover:underline font-medium flex items-center gap-0.5"
              >
                Full map <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-2 pb-2">
              <TerritoryMap contacts={data.mapContacts} height={340} />
            </div>
          </div>

          {/* Territory breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">
              By County
            </h2>
            <div className="space-y-3">
              {data.territoryBreakdown
                .sort((a, b) => b.count - a.count)
                .map((t) => {
                  const pct = Math.round(
                    (t.count / data.totalContacts) * 100
                  );
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">
                          {t.name}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums">
                          {t.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C4A265] transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
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
