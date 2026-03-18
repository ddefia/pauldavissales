"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Map, List, Users, Search, X, ChevronRight, Building2,
} from "lucide-react";
import PropertyDetailPanel from "@/components/properties/property-detail-panel";

const PropertyMap = dynamic(() => import("@/components/maps/property-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] rounded-2xl bg-gray-50 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-300">Loading map...</span>
    </div>
  ),
});

interface MapProperty {
  id: string;
  name: string;
  propertyType: string | null;
  addressLine1: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  unitCount: number | null;
  yearBuilt: number | null;
  opportunityScore: number | null;
  territory: string | null;
  contactCount: number;
  riskLevel: string | null;
}

type ViewMode = "map" | "list";
type OppFilter = "all" | "high" | "medium";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "LUXURY_CONDO", label: "Luxury Condo" },
  { value: "HIGH_RISE", label: "High-Rise" },
  { value: "MID_RISE", label: "Mid-Rise" },
  { value: "LOW_RISE", label: "Low-Rise" },
  { value: "TOWNHOME", label: "Townhome" },
  { value: "HOA_COMMUNITY", label: "HOA Community" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "MIXED_USE", label: "Mixed Use" },
];

function TypeBadge({ type }: { type: string | null }) {
  const label = (type || "—").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const colors: Record<string, string> = {
    HIGH_RISE: "bg-red-50 text-red-600",
    LUXURY_CONDO: "bg-purple-50 text-purple-600",
    MID_RISE: "bg-blue-50 text-blue-600",
    COMMERCIAL: "bg-orange-50 text-orange-600",
    HOA_COMMUNITY: "bg-green-50 text-green-600",
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[type || ""] || "bg-gray-100 text-gray-500"}`}>{label}</span>;
}

function OppBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-300">—</span>;
  const color = score >= 70 ? "bg-red-50 text-red-600 border-red-100" : score >= 40 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-gray-50 text-gray-400 border-gray-100";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${color}`}>{score}</span>;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [oppFilter, setOppFilter] = useState<OppFilter>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [stats, setStats] = useState({ total: 0, highOpp: 0, medOpp: 0 });

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("propertyType", typeFilter);
    if (oppFilter === "high") params.set("minOpportunity", "70");
    else if (oppFilter === "medium") params.set("minOpportunity", "40");

    const res = await fetch(`/api/properties/map?${params}`);
    const d = await res.json();
    setProperties(d.data.properties);
    setStats(d.data.stats);
    setLoading(false);
  }, [typeFilter, oppFilter]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const filtered = properties.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.addressLine1.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) || (p.territory || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {stats.total} properties · <span className="text-red-500 font-medium">{stats.highOpp} high opportunity</span> · {stats.medOpp} medium
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-full p-0.5">
          <button onClick={() => setView("map")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "map" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <Map className="h-3.5 w-3.5" /> Map
          </button>
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C4A265]/30 focus:border-[#C4A265]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-gray-400" /></button>}
        </div>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C4A265]/30">
          {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <div className="flex bg-gray-100 rounded-xl p-0.5">
          {(["all", "high", "medium"] as OppFilter[]).map((f) => (
            <button key={f} onClick={() => setOppFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${oppFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              {f === "all" ? "All" : f === "high" ? "🔴 High Opp" : "🟠 Medium"}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400">{filtered.length} showing</span>
      </div>

      {/* Map */}
      {view === "map" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <PropertyMap properties={filtered} onPropertyClick={(id) => setSelectedId(id)} selectedId={selectedId} height={500} />
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">{view === "map" ? "Top Properties" : "All Properties"}</h2>
          <span className="text-xs text-gray-400">{filtered.length} properties</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading properties...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No properties match your filters</div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filtered.slice(0, view === "map" ? 20 : 200).map((p) => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left ${selectedId === p.id ? "bg-amber-50/50" : ""}`}>
                <OppBadge score={p.opportunityScore} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {p.city} · {p.territory || "Unassigned"}
                    {p.unitCount ? ` · ${p.unitCount} units` : ""}
                    {p.yearBuilt ? ` · Built ${p.yearBuilt}` : ""}
                  </p>
                </div>
                <TypeBadge type={p.propertyType} />
                <div className="flex items-center gap-1 shrink-0">
                  <Users className="h-3 w-3 text-gray-300" />
                  <span className="text-xs text-gray-400">{p.contactCount}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-200 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedId && (
        <>
          <div className="fixed inset-0 bg-black/10 z-40" onClick={() => setSelectedId(null)} />
          <PropertyDetailPanel propertyId={selectedId} onClose={() => setSelectedId(null)} />
        </>
      )}
    </div>
  );
}
