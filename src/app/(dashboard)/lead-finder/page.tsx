"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  UserPlus,
  Check,
  Lightbulb,
  Brain,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  Building2,
  Map as MapIcon,
  List,
  Users,
} from "lucide-react";
import Link from "next/link";

interface FoundLead {
  fullName: string;
  title: string;
  organizationName: string;
  orgType: string;
  email: string | null;
  phone: string | null;
  propertyName: string | null;
  propertyType: string | null;
  city: string;
  state: string;
  zipCode: string;
  reasoning: string;
}

interface MapCity {
  city: string;
  lat: number;
  lng: number;
  territory: string;
  contactCount: number;
  orgCount: number;
  avgScore: number | null;
  contacts: {
    id: string;
    fullName: string;
    title: string | null;
    email: string | null;
    orgName: string | null;
    orgType: string | null;
    score: number | null;
  }[];
  orgs: { id: string; name: string; orgType: string | null }[];
}

const QUICK_SEARCHES = [
  "Property management companies in Palm Beach County with 50+ unit buildings",
  "HOA and COA boards in Jupiter and Tequesta managing coastal condos",
  "High-rise building managers in West Palm Beach and Boca Raton",
  "Commercial property owners in Martin County near the coast",
  "New condo developments in St. Lucie County breaking ground this year",
];

const TERRITORY_COLORS: Record<string, string> = {
  "Palm Beach County": "#3b82f6",
  "Martin County": "#10b981",
  "St. Lucie County": "#f59e0b",
  "Indian River County": "#8b5cf6",
};

// City coordinates for placing AI-generated leads on the map
const CITY_COORDS: Record<string, [number, number]> = {
  "West Palm Beach": [26.7153, -80.0534],
  "Palm Beach": [26.7056, -80.0364],
  "Palm Beach Gardens": [26.8234, -80.1387],
  "Jupiter": [26.9342, -80.0942],
  "Tequesta": [26.9687, -80.1081],
  "Juno Beach": [26.8798, -80.0534],
  "Lake Worth": [26.6168, -80.0571],
  "Lake Worth Beach": [26.6168, -80.0571],
  "Boynton Beach": [26.5254, -80.0662],
  "Delray Beach": [26.4615, -80.0728],
  "Boca Raton": [26.3683, -80.1289],
  "Lantana": [26.5868, -80.052],
  "Riviera Beach": [26.7754, -80.0581],
  "Royal Palm Beach": [26.7084, -80.2306],
  "Wellington": [26.6618, -80.2414],
  "Stuart": [27.1975, -80.2531],
  "Palm City": [27.167, -80.2664],
  "Jensen Beach": [27.2544, -80.2292],
  "Hobe Sound": [27.0595, -80.1363],
  "Port St. Lucie": [27.273, -80.3582],
  "Port Saint Lucie": [27.273, -80.3582],
  "Fort Pierce": [27.4467, -80.3256],
  "Vero Beach": [27.6386, -80.3973],
  "Sebastian": [27.8164, -80.4708],
  "North Palm Beach": [26.8176, -80.0819],
};

function LeadFinderMap({
  cities,
  searchResults,
  onCityClick,
}: {
  cities: MapCity[];
  searchResults: FoundLead[] | null;
  onCityClick?: (city: MapCity) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [27.0, -80.2],
        zoom: 9,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setLoaded(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when cities or search results change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !loaded) return;

    import("leaflet").then((L) => {
      // Clear old markers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      // Add city markers for existing contacts
      cities.forEach((city) => {
        const color = TERRITORY_COLORS[city.territory] || "#6b7280";
        const radius = Math.min(8 + Math.sqrt(city.contactCount) * 4, 30);

        const circle = L.circleMarker([city.lat, city.lng], {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map);

        // Build popup with contacts list
        const contactRows = city.contacts
          .slice(0, 5)
          .map(
            (c) =>
              `<div style="padding:2px 0;font-size:11px;border-bottom:1px solid #f3f4f6;">
                <span style="font-weight:500;">${c.fullName}</span>
                ${c.orgName ? `<br/><span style="color:#6b7280;font-size:10px;">${c.orgName}</span>` : ""}
              </div>`
          )
          .join("");

        circle.bindPopup(`
          <div style="font-family:system-ui;min-width:200px;max-width:280px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${city.city}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${city.territory}</div>
            <div style="display:flex;gap:12px;font-size:12px;margin-bottom:8px;padding:4px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
              <div><span style="font-weight:600;">${city.contactCount}</span> contacts</div>
              <div><span style="font-weight:600;">${city.orgCount}</span> companies</div>
              ${city.avgScore != null ? `<div>avg score: <span style="font-weight:600;">${city.avgScore}</span></div>` : ""}
            </div>
            ${contactRows}
            ${city.contacts.length < city.contactCount ? `<div style="font-size:10px;color:#9ca3af;padding-top:4px;">+ ${city.contactCount - city.contacts.length} more</div>` : ""}
          </div>
        `);

        // Count label
        if (city.contactCount > 3) {
          const label = L.divIcon({
            className: "city-count-label",
            html: `<div style="
              font-size:${radius > 15 ? 11 : 9}px;font-weight:700;color:#fff;
              text-shadow:0 1px 2px rgba(0,0,0,0.5);
              text-align:center;line-height:${radius * 2}px;
              width:${radius * 2}px;height:${radius * 2}px;
              pointer-events:none;
            ">${city.contactCount}</div>`,
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          });
          const labelMarker = L.marker([city.lat, city.lng], {
            icon: label,
            interactive: false,
          }).addTo(map);
          markersRef.current.push(labelMarker);
        }

        markersRef.current.push(circle);
      });

      // Add search result markers (gold/red pins)
      if (searchResults && searchResults.length > 0) {
        searchResults.forEach((lead, idx) => {
          const coords = CITY_COORDS[lead.city];
          if (!coords) return;

          // Offset slightly so multiple results in same city don't overlap
          const offset = idx * 0.003;
          const lat = coords[0] + offset * Math.cos(idx * 1.5);
          const lng = coords[1] + offset * Math.sin(idx * 1.5);

          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "search-result-pin",
              html: `<div style="
                width:28px;height:28px;border-radius:50% 50% 50% 0;
                background:#C4A265;transform:rotate(-45deg);
                display:flex;align-items:center;justify-content:center;
                border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
              "><span style="transform:rotate(45deg);font-size:12px;font-weight:700;color:#fff;">${idx + 1}</span></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
              popupAnchor: [0, -28],
            }),
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-family:system-ui;min-width:180px;">
              <div style="font-weight:700;font-size:13px;">${lead.fullName}</div>
              <div style="font-size:11px;color:#6b7280;">${lead.title}</div>
              <div style="font-size:12px;font-weight:500;margin-top:2px;">${lead.organizationName}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px;">
                ${lead.city}, ${lead.state} ${lead.zipCode}
              </div>
              ${lead.email ? `<div style="font-size:10px;color:#3b82f6;margin-top:4px;">${lead.email}</div>` : ""}
              <div style="font-size:10px;color:#C4A265;margin-top:4px;font-style:italic;">${lead.reasoning.slice(0, 100)}${lead.reasoning.length > 100 ? "..." : ""}</div>
            </div>
          `);

          markersRef.current.push(marker);
        });

        // Fit bounds to show search results
        const resultCoords = searchResults
          .map((l) => CITY_COORDS[l.city])
          .filter(Boolean) as [number, number][];
        if (resultCoords.length > 0) {
          const allCoords = [
            ...resultCoords,
            ...cities.map((c) => [c.lat, c.lng] as [number, number]),
          ];
          map.fitBounds(allCoords, { padding: [40, 40], maxZoom: 12 });
        }
      } else if (cities.length > 1) {
        // Fit to existing contacts
        const allCoords = cities.map((c) => [c.lat, c.lng] as [number, number]);
        map.fitBounds(allCoords, { padding: [30, 30] });
      }
    });
  }, [cities, searchResults, loaded]);

  return (
    <div className="relative rounded-lg overflow-hidden border">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} style={{ height: 500, width: "100%" }} />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100" style={{ height: 500 }}>
          <div className="text-sm text-gray-500">Loading map...</div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-lg p-2.5 shadow-sm border text-xs space-y-1">
        <p className="font-semibold text-gray-700 mb-1">Your Contacts</p>
        {Object.entries(TERRITORY_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{name}</span>
          </div>
        ))}
        {searchResults && searchResults.length > 0 && (
          <>
            <div className="border-t pt-1 mt-1">
              <p className="font-semibold text-gray-700 mb-0.5">AI Results</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#C4A265" }} />
                <span className="text-gray-600">New leads</span>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Stats overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-sm border">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{cities.reduce((s, c) => s + c.contactCount, 0)}</span>
            <span className="text-gray-500">contacts</span>
          </div>
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{cities.reduce((s, c) => s + c.orgCount, 0)}</span>
            <span className="text-gray-500">companies</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{cities.length}</span>
            <span className="text-gray-500">cities</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeadFinderPage() {
  const [query, setQuery] = useState("");
  const [territory, setTerritory] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundLead[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [importingIdx, setImportingIdx] = useState<number | null>(null);
  const [importedContactIds, setImportedContactIds] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enrichingIdx, setEnrichingIdx] = useState<number | null>(null);
  const [enrichedIds, setEnrichedIds] = useState<Set<number>>(new Set());
  const [mapCities, setMapCities] = useState<MapCity[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // Load map data
  useEffect(() => {
    const params = new URLSearchParams();
    if (territory) params.set("territory", territory);
    fetch(`/api/contacts/map?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setMapCities(d.data?.cities || []);
        setMapLoading(false);
      })
      .catch(() => setMapLoading(false));
  }, [territory]);

  async function searchLeads(searchQuery?: string) {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setSearching(true);
    setResults(null);
    setSuggestions([]);
    setError(null);
    setImportedIds(new Set());
    setImportedContactIds({});
    setEnrichedIds(new Set());

    try {
      const res = await fetch("/api/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          territory: territory || undefined,
          limit: 10,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || `HTTP ${res.status}`);
      } else if (d.data) {
        setResults(d.data.leads || []);
        setSuggestions(d.data.suggestions || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to search — check your network and API key");
      setResults([]);
    }
    setSearching(false);
  }

  async function importLead(lead: FoundLead, idx: number) {
    setImportingIdx(idx);
    try {
      const res = await fetch("/api/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importLead: lead }),
      });
      const d = await res.json();
      if (d.data?.contactId) {
        setImportedIds((prev) => new Set([...prev, idx]));
        setImportedContactIds((prev) => ({ ...prev, [idx]: d.data.contactId }));
      }
    } catch {}
    setImportingIdx(null);
  }

  async function enrichLead(contactId: string, idx: number) {
    setEnrichingIdx(idx);
    try {
      const res = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      if (res.ok) {
        setEnrichedIds((prev) => new Set([...prev, idx]));
      }
    } catch {}
    setEnrichingIdx(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Finder</h1>
          <p className="text-sm text-gray-500">
            AI-powered prospecting with map view — search for leads and see them on the map
          </p>
        </div>
        <div className="flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${
              viewMode === "map" ? "bg-gray-100 font-medium" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 border-l ${
              viewMode === "list" ? "bg-gray-100 font-medium" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe the type of leads you're looking for. Be specific about property types, locations, roles, or industries..."
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y"
            />
            <div className="flex gap-3 items-center">
              <select
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <option value="">All Territories</option>
                <option value="Palm Beach County">Palm Beach County</option>
                <option value="Martin County">Martin County</option>
                <option value="St. Lucie County">St. Lucie County</option>
                <option value="Indian River County">Indian River County</option>
              </select>
              <Button onClick={() => searchLeads()} disabled={searching || !query.trim()}>
                {searching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {searching ? "Searching..." : "Find Leads"}
              </Button>
            </div>
          </div>

          {/* Quick Search Chips */}
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Quick searches:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((qs, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(qs);
                    searchLeads(qs);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {qs.length > 60 ? qs.slice(0, 57) + "..." : qs}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 font-medium">Search failed: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Map View */}
      {viewMode === "map" && (
        <div>
          {mapLoading ? (
            <div className="flex items-center justify-center py-12 border rounded-lg bg-gray-50">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading map data...</span>
            </div>
          ) : (
            <LeadFinderMap cities={mapCities} searchResults={results} />
          )}
        </div>
      )}

      {/* Searching spinner */}
      {searching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Searching for leads...</span>
        </div>
      )}

      {/* Results */}
      {results && !searching && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {results.length} Lead{results.length !== 1 ? "s" : ""} Found
            </h2>
            <Badge variant="outline">AI-Generated — Verify before outreach</Badge>
          </div>

          {results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium">No leads found</h3>
                <p className="text-sm text-gray-500">
                  Try broadening your search or using different criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((lead, idx) => (
                <Card key={idx} className={importedIds.has(idx) ? "border-green-200 bg-green-50/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {/* Map pin number */}
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C4A265] text-white text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-base">{lead.fullName}</span>
                          <Badge variant="outline" className="text-xs">
                            {lead.orgType.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {lead.title} at <span className="font-medium">{lead.organizationName}</span>
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {lead.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {lead.city}, {lead.state} {lead.zipCode}
                          </span>
                          {lead.propertyName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {lead.propertyName} ({lead.propertyType?.replaceAll("_", " ")})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-2 italic">
                          &ldquo;{lead.reasoning}&rdquo;
                        </p>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        {importedIds.has(idx) ? (
                          <>
                            <Badge className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" /> Imported
                            </Badge>
                            {enrichedIds.has(idx) ? (
                              <Badge className="bg-purple-600">
                                <Sparkles className="h-3 w-3 mr-1" /> Enriched
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                onClick={() => enrichLead(importedContactIds[idx], idx)}
                                disabled={enrichingIdx === idx}
                              >
                                {enrichingIdx === idx ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Brain className="mr-1 h-3 w-3" />
                                )}
                                {enrichingIdx === idx ? "Enriching..." : "Enrich"}
                              </Button>
                            )}
                            <Link
                              href={`/contacts/${importedContactIds[idx]}`}
                              className="text-xs text-gray-600 hover:text-[#C4A265] hover:underline"
                            >
                              View Contact →
                            </Link>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => importLead(lead, idx)}
                            disabled={importingIdx === idx}
                          >
                            {importingIdx === idx ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="mr-1 h-3 w-3" />
                            )}
                            Import
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Strategic Suggestions</p>
                    <ul className="mt-1 list-disc list-inside text-sm text-amber-700 space-y-1">
                      {suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
