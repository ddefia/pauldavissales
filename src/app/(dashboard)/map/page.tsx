"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Building2,
  Users,
  Layers,
  X,
  ChevronRight,
  Loader2,
  Phone,
  Mail,
  Zap,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────

interface CityCluster {
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
    score: number | null;
  }[];
}

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
  riskLevel: string | null;
  contactCount: number;
  territory: string | null;
}

type LayerMode = "contacts" | "properties" | "both";

// ── Helpers ────────────────────────────────────────────────

const TERRITORY_COLORS: Record<string, string> = {
  "Palm Beach County": "#3b82f6",
  "Martin County": "#22c55e",
  "St. Lucie County": "#f59e0b",
  "Indian River County": "#a855f7",
};

function scoreColor(score: number | null): string {
  if (!score) return "#9ca3af";
  if (score >= 60) return "#ef4444";
  if (score >= 35) return "#f59e0b";
  return "#9ca3af";
}

// ── Component ──────────────────────────────────────────────

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<CityCluster[]>([]);
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [layer, setLayer] = useState<LayerMode>("contacts");
  const [territory, setTerritory] = useState("");
  const [selected, setSelected] = useState<CityCluster | MapProperty | null>(null);
  const [selectedType, setSelectedType] = useState<"city" | "property" | null>(null);

  // Stats
  const [contactStats, setContactStats] = useState({ total: 0, cities: 0 });
  const [propertyStats, setPropertyStats] = useState({ total: 0, highOpp: 0, medOpp: 0 });

  // ── Data fetching ──

  const fetchContacts = useCallback(async () => {
    const qs = territory ? `?territory=${encodeURIComponent(territory)}` : "";
    const res = await fetch(`/api/contacts/map${qs}`);
    const d = await res.json();
    setCities(d.data?.cities || []);
    setContactStats({
      total: d.data?.totalContacts || 0,
      cities: d.data?.totalCities || 0,
    });
  }, [territory]);

  const fetchProperties = useCallback(async () => {
    const qs = territory ? `?territory=${encodeURIComponent(territory)}` : "";
    const res = await fetch(`/api/properties/map${qs}`);
    const d = await res.json();
    setProperties(
      (d.data?.properties || []).filter(
        (p: MapProperty) => p.latitude && p.longitude
      )
    );
    setPropertyStats(d.data?.stats || { total: 0, highOpp: 0, medOpp: 0 });
  }, [territory]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchContacts(), fetchProperties()]).finally(() =>
      setLoading(false)
    );
  }, [fetchContacts, fetchProperties]);

  // ── Map rendering ──

  useEffect(() => {
    if (!mapRef.current || loading) return;

    let L: any;
    (async () => {
      L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (leafletMap.current) {
        leafletMap.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [26.75, -80.15],
        zoom: 10,
        zoomControl: false,
      });
      leafletMap.current = map;

      // Zoom control top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Dark-ish tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap &copy; CartoDB",
          maxZoom: 19,
        }
      ).addTo(map);

      renderMarkers(L, map);
    })();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [loading]);

  // Re-render markers when layer/data changes
  useEffect(() => {
    if (!leafletMap.current) return;
    (async () => {
      const L = await import("leaflet");
      renderMarkers(L, leafletMap.current!);
    })();
  }, [layer, cities, properties, territory]);

  function renderMarkers(L: any, map: any) {
    // Clear existing
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const allMarkers: any[] = [];

    // Contact city clusters
    if (layer === "contacts" || layer === "both") {
      cities.forEach((c) => {
        const color = TERRITORY_COLORS[c.territory] || "#6b7280";
        const radius = Math.min(8 + Math.sqrt(c.contactCount) * 2.5, 28);

        const marker = L.circleMarker([c.lat, c.lng], {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 2,
          fillOpacity: 0.8,
        }).addTo(map);

        // Count label
        if (c.contactCount > 3) {
          const label = L.divIcon({
            className: "",
            html: `<div style="font-size:10px;font-weight:700;color:#fff;text-align:center;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.5)">${c.contactCount}</div>`,
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          });
          const labelMarker = L.marker([c.lat, c.lng], { icon: label, interactive: false }).addTo(map);
          markersRef.current.push(labelMarker);
        }

        marker.on("click", () => {
          setSelected(c);
          setSelectedType("city");
        });

        allMarkers.push(marker);
        markersRef.current.push(marker);
      });
    }

    // Property markers
    if (layer === "properties" || layer === "both") {
      properties.forEach((p) => {
        if (!p.latitude || !p.longitude) return;

        const color = scoreColor(p.opportunityScore);
        const radius = Math.min(5 + Math.sqrt(p.unitCount || 1) * 1.2, 18);

        const marker = L.circleMarker([p.latitude, p.longitude], {
          radius,
          fillColor: color,
          color: layer === "both" ? "#000" : "#fff",
          weight: layer === "both" ? 1 : 1.5,
          fillOpacity: 0.85,
        }).addTo(map);

        marker.on("click", () => {
          setSelected(p);
          setSelectedType("property");
        });

        allMarkers.push(marker);
        markersRef.current.push(marker);
      });
    }

    // Fit bounds
    if (allMarkers.length > 0) {
      const group = L.featureGroup(allMarkers);
      map.fitBounds(group.getBounds().pad(0.05));
    }
  }

  // ── Render ──

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b z-10">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-[#C4A265]" />
          <h1 className="text-lg font-bold">Territory Map</h1>
          {!loading && (
            <span className="text-xs text-gray-400">
              {contactStats.total} contacts · {propertyStats.total} properties
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Territory filter */}
          <select
            value={territory}
            onChange={(e) => {
              setTerritory(e.target.value);
              setSelected(null);
            }}
            className="text-xs border rounded-md px-2 py-1.5 bg-white"
          >
            <option value="">All Territories</option>
            <option value="Palm Beach County">Palm Beach County</option>
            <option value="Martin County">Martin County</option>
            <option value="St. Lucie County">St. Lucie County</option>
            <option value="Indian River County">Indian River County</option>
          </select>

          {/* Layer toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setLayer("contacts"); setSelected(null); }}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${
                layer === "contacts" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              <Users className="h-3 w-3" /> Contacts
            </button>
            <button
              onClick={() => { setLayer("properties"); setSelected(null); }}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${
                layer === "properties" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              <Building2 className="h-3 w-3" /> Properties
            </button>
            <button
              onClick={() => { setLayer("both"); setSelected(null); }}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${
                layer === "both" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              <Layers className="h-3 w-3" /> Both
            </button>
          </div>
        </div>
      </div>

      {/* Map + panel */}
      <div className="flex flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Map */}
        <div ref={mapRef} className="flex-1" />

        {/* Detail panel */}
        {selected && (
          <div className="w-80 bg-white border-l overflow-y-auto shadow-lg animate-in slide-in-from-right-5">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <h3 className="font-bold text-sm truncate pr-2">
                {selectedType === "city"
                  ? (selected as CityCluster).city
                  : (selected as MapProperty).name}
              </h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {selectedType === "city" && (() => {
                const city = selected as CityCluster;
                return (
                  <>
                    <div className="flex gap-2">
                      <Badge
                        className="text-[10px]"
                        style={{ backgroundColor: TERRITORY_COLORS[city.territory] || "#6b7280" }}
                      >
                        {city.territory}
                      </Badge>
                      {city.avgScore && (
                        <Badge variant="outline" className="text-[10px]">
                          Avg score: {city.avgScore}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold">{city.contactCount}</p>
                        <p className="text-[10px] text-gray-500">Contacts</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold">{city.orgCount}</p>
                        <p className="text-[10px] text-gray-500">Companies</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                        Top Contacts
                      </p>
                      <div className="space-y-1.5">
                        {city.contacts
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .map((c) => (
                            <Link
                              key={c.id}
                              href={`/contacts/${c.id}`}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition group"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-[#C4A265]">
                                  {c.fullName}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {c.title || c.orgName || ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {c.score != null && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      color: scoreColor(c.score),
                                      backgroundColor: `${scoreColor(c.score)}15`,
                                    }}
                                  >
                                    {c.score}
                                  </span>
                                )}
                                <ChevronRight className="h-3 w-3 text-gray-300" />
                              </div>
                            </Link>
                          ))}
                      </div>
                    </div>
                  </>
                );
              })()}

              {selectedType === "property" && (() => {
                const prop = selected as MapProperty;
                return (
                  <>
                    <p className="text-xs text-gray-500">
                      {prop.addressLine1}, {prop.city}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {prop.propertyType && (
                        <Badge variant="outline" className="text-[10px]">
                          {prop.propertyType.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {prop.unitCount && (
                        <Badge variant="outline" className="text-[10px]">
                          {prop.unitCount} units
                        </Badge>
                      )}
                      {prop.yearBuilt && (
                        <Badge variant="outline" className="text-[10px]">
                          Built {prop.yearBuilt}
                        </Badge>
                      )}
                      {prop.riskLevel && (
                        <Badge
                          variant={prop.riskLevel === "HIGH" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {prop.riskLevel} risk
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold" style={{ color: scoreColor(prop.opportunityScore) }}>
                          {prop.opportunityScore ?? "—"}
                        </p>
                        <p className="text-[10px] text-gray-500">Opp. Score</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold">{prop.contactCount}</p>
                        <p className="text-[10px] text-gray-500">Contacts</p>
                      </div>
                    </div>
                    {prop.territory && (
                      <Badge
                        className="text-[10px]"
                        style={{ backgroundColor: TERRITORY_COLORS[prop.territory] || "#6b7280" }}
                      >
                        {prop.territory}
                      </Badge>
                    )}
                    <Link href={`/properties/${prop.id}`}>
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        View Property Details
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
