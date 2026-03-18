"use client";

import { useEffect, useRef } from "react";

export interface PropertyMapItem {
  id: string;
  name: string;
  propertyType: string | null;
  addressLine1: string;
  city: string;
  unitCount: number | null;
  yearBuilt: number | null;
  opportunityScore: number | null;
  latitude: number | null;
  longitude: number | null;
  contactCount: number;
  riskLevel: string | null;
}

interface Props {
  properties: PropertyMapItem[];
  onPropertyClick?: (id: string) => void;
  height?: number;
  selectedId?: string | null;
}

function getColor(score: number | null): string {
  if (!score) return "#9ca3af";
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#9ca3af";
}

function getRadius(units: number | null): number {
  if (!units) return 6;
  return Math.min(6 + Math.sqrt(units) * 1.5, 22);
}

export default function PropertyMap({ properties, onPropertyClick, height = 500, selectedId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let L: typeof import("leaflet");

    (async () => {
      L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (leafletMap.current) {
        leafletMap.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [26.7, -80.1],
        zoom: 10,
        zoomControl: true,
      });
      leafletMap.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CartoDB",
        maxZoom: 19,
      }).addTo(map);

      const markers: L.CircleMarker[] = [];

      properties.forEach((p) => {
        if (!p.latitude || !p.longitude) return;

        const color = getColor(p.opportunityScore);
        const radius = getRadius(p.unitCount);
        const isSelected = p.id === selectedId;

        const marker = L.circleMarker([p.latitude, p.longitude], {
          radius: isSelected ? radius + 4 : radius,
          fillColor: color,
          color: isSelected ? "#1a1a1a" : "#fff",
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(map);

        const typeLabel = (p.propertyType || "Unknown").replace(/_/g, " ").toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());

        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.name}</div>
            <div style="font-size:12px;color:#666;margin-bottom:8px">${p.addressLine1}, ${p.city}</div>
            <div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">
                Score: ${p.opportunityScore ?? "—"}
              </span>
              <span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:11px;color:#666">
                ${typeLabel}
              </span>
            </div>
            <div style="font-size:11px;color:#888;line-height:1.5">
              ${p.unitCount ? `${p.unitCount} units · ` : ""}${p.yearBuilt ? `Built ${p.yearBuilt} · ` : ""}${p.contactCount} contacts
            </div>
          </div>
        `, { closeButton: false });

        marker.on("click", () => {
          if (onPropertyClick) onPropertyClick(p.id);
        });

        markers.push(marker);
      });

      // Fit bounds
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }

      // Legend
      const legend = L.control({ position: "bottomleft" } as L.ControlOptions);
      legend.onAdd = () => {
        const div = L.DomUtil.create("div");
        div.innerHTML = `
          <div style="background:white;padding:10px 14px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);font-family:system-ui;font-size:11px">
            <div style="font-weight:600;margin-bottom:6px;color:#333">Opportunity</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block"></span> High (70+)</div>
              <div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block"></span> Medium (40–69)</div>
              <div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:#9ca3af;display:inline-block"></span> Low (&lt;40)</div>
            </div>
          </div>
        `;
        return div;
      };
      legend.addTo(map);
    })();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [properties, selectedId]);

  return <div ref={mapRef} style={{ height, width: "100%", borderRadius: 16 }} />;
}
