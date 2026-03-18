"use client";

import { useEffect, useRef, useState } from "react";

// South Florida city → [lat, lng] lookup
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
  "Lantana": [26.5868, -80.0520],
  "Riviera Beach": [26.7754, -80.0581],
  "Royal Palm Beach": [26.7084, -80.2306],
  "Wellington": [26.6618, -80.2414],
  "Greenacres": [26.6276, -80.1353],
  "Stuart": [27.1975, -80.2531],
  "Palm City": [27.1670, -80.2664],
  "Jensen Beach": [27.2544, -80.2292],
  "Hobe Sound": [27.0595, -80.1363],
  "Port St. Lucie": [27.2730, -80.3582],
  "Port Saint Lucie": [27.2730, -80.3582],
  "Fort Pierce": [27.4467, -80.3256],
  "Tradition": [27.2534, -80.3954],
  "Vero Beach": [27.6386, -80.3973],
  "Sebastian": [27.8164, -80.4708],
  "Indian River Shores": [27.7175, -80.3789],
  "North Palm Beach": [26.8176, -80.0819],
  "Hypoluxo": [26.5568, -80.0498],
  "Ocean Ridge": [26.5268, -80.0487],
  "Manalapan": [26.5768, -80.0409],
  "Gulf Stream": [26.4868, -80.0454],
  "Highland Beach": [26.3968, -80.0654],
  "Hutchinson Island": [27.3300, -80.2200],
};

const TERRITORY_COLORS: Record<string, string> = {
  "Palm Beach County": "#3b82f6",
  "Martin County": "#10b981",
  "St. Lucie County": "#f59e0b",
  "Indian River County": "#8b5cf6",
};

export interface MapContact {
  id: string;
  fullName: string;
  city: string | null;
  territory: string | null;
  compositeScore: number | null;
  status: string;
}

interface TerritoryMapProps {
  contacts: MapContact[];
  height?: number;
}

export default function TerritoryMap({ contacts, height = 400 }: TerritoryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default marker icons
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

      // Group contacts by city for clustering
      const cityGroups: Record<string, { contacts: MapContact[]; coords: [number, number] }> = {};

      contacts.forEach((c) => {
        if (!c.city) return;
        const cityKey = c.city.trim();
        const coords = CITY_COORDS[cityKey];
        if (!coords) return;

        if (!cityGroups[cityKey]) {
          cityGroups[cityKey] = { contacts: [], coords };
        }
        cityGroups[cityKey].contacts.push(c);
      });

      // Add circle markers for each city cluster
      Object.entries(cityGroups).forEach(([city, group]) => {
        const count = group.contacts.length;
        const territory = group.contacts[0]?.territory || "Unknown";
        const color = TERRITORY_COLORS[territory] || "#6b7280";
        const avgScore = group.contacts.reduce((sum, c) => sum + (c.compositeScore || 0), 0) / count;

        // Size based on contact count
        const radius = Math.min(8 + Math.sqrt(count) * 4, 30);

        const circle = L.circleMarker(group.coords, {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.7,
        }).addTo(map);

        // Popup with city info
        const scored = group.contacts.filter((c) => c.compositeScore != null).length;
        circle.bindPopup(`
          <div style="font-family: system-ui; min-width: 160px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${city}</div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${territory}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px;">
              <div><span style="font-weight: 600;">${count}</span> contacts</div>
              <div><span style="font-weight: 600;">${scored}</span> scored</div>
              ${avgScore > 0 ? `<div>Avg score: <span style="font-weight: 600;">${Math.round(avgScore)}</span></div>` : ""}
            </div>
          </div>
        `);

        // Count label on larger clusters
        if (count > 5) {
          const label = L.divIcon({
            className: "city-label",
            html: `<div style="
              font-size: 11px; font-weight: 700; color: #fff;
              text-shadow: 0 1px 2px rgba(0,0,0,0.5);
              text-align: center; line-height: ${radius * 2}px;
              width: ${radius * 2}px; height: ${radius * 2}px;
            ">${count}</div>`,
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          });
          L.marker(group.coords, { icon: label, interactive: false }).addTo(map);
        }
      });

      mapInstanceRef.current = map;
      setLoaded(true);

      // Fit bounds to show all markers
      const allCoords = Object.values(cityGroups).map((g) => g.coords);
      if (allCoords.length > 1) {
        map.fitBounds(allCoords.map((c) => [c[0], c[1]]) as [number, number][], {
          padding: [30, 30],
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [contacts]);

  return (
    <div className="relative rounded-lg overflow-hidden border">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} style={{ height, width: "100%" }} />
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100"
          style={{ height }}
        >
          <div className="text-sm text-gray-500">Loading map...</div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-lg p-2 shadow-sm border text-xs">
        {Object.entries(TERRITORY_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5 py-0.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-700">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
