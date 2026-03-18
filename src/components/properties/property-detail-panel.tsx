"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X, Building2, MapPin, Phone, Mail, Users, Calendar,
  Layers, Droplets, Shield, ChevronRight, Zap,
} from "lucide-react";

interface ContactLink {
  id: string;
  contact: {
    id: string;
    fullName: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    compositeScore: number | null;
    organization: { name: string } | null;
  };
  role: string | null;
  isPrimary: boolean;
}

interface OrgLink {
  id: string;
  organization: {
    id: string;
    name: string;
    orgType: string | null;
  };
  relationship: string | null;
}

interface PropertyDetail {
  id: string;
  name: string;
  propertyType: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  unitCount: number | null;
  yearBuilt: number | null;
  floors: number | null;
  totalSqFt: number | null;
  floodZone: string | null;
  coastalExposure: boolean | null;
  riskLevel: string | null;
  opportunityScore: number | null;
  enrichmentBrief: string | null;
  riskFactors: string[];
  territory: { name: string } | null;
  contacts: ContactLink[];
  organizations: OrgLink[];
}

interface Props {
  propertyId: string | null;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-400">—</span>;
  const color = score >= 70 ? "bg-red-50 text-red-600" : score >= 40 ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
}

function TypeBadge({ type }: { type: string | null }) {
  const label = (type || "Unknown").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{label}</span>;
}

export default function PropertyDetailPanel({ propertyId, onClose }: Props) {
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/properties/${propertyId}`)
      .then((r) => r.json())
      .then((d) => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId]);

  if (!propertyId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
        <div className="flex-1 min-w-0 mr-3">
          {loading ? (
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-900 truncate">{data?.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {data?.addressLine1}, {data?.city}
              </p>
            </>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-5 space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : data ? (
          <div className="p-5 space-y-5">
            {/* Score + Type */}
            <div className="flex items-center gap-2">
              <ScoreBadge score={data.opportunityScore} />
              <TypeBadge type={data.propertyType} />
              {data.territory && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{data.territory.name}</span>
              )}
            </div>

            {/* Property Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {data.unitCount && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><Layers className="h-3 w-3 text-gray-400" /><span className="text-[10px] text-gray-400 uppercase tracking-wider">Units</span></div>
                  <p className="text-lg font-bold text-gray-900">{data.unitCount}</p>
                </div>
              )}
              {data.yearBuilt && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><Calendar className="h-3 w-3 text-gray-400" /><span className="text-[10px] text-gray-400 uppercase tracking-wider">Built</span></div>
                  <p className="text-lg font-bold text-gray-900">{data.yearBuilt}</p>
                </div>
              )}
              {data.floors && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><Building2 className="h-3 w-3 text-gray-400" /><span className="text-[10px] text-gray-400 uppercase tracking-wider">Floors</span></div>
                  <p className="text-lg font-bold text-gray-900">{data.floors}</p>
                </div>
              )}
              {data.floodZone && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><Droplets className="h-3 w-3 text-gray-400" /><span className="text-[10px] text-gray-400 uppercase tracking-wider">Flood Zone</span></div>
                  <p className="text-lg font-bold text-gray-900">{data.floodZone}</p>
                </div>
              )}
            </div>

            {/* Risk Factors */}
            {data.riskFactors && data.riskFactors.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-semibold text-gray-700">Risk Factors</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.riskFactors.map((rf, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded-full">{rf}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Enrichment Brief */}
            {data.enrichmentBrief && (
              <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-amber-900 italic leading-relaxed">{data.enrichmentBrief}</p>
              </div>
            )}

            {/* Who Manages This Building? */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#C4A265]" />
                Who manages this building?
              </h3>
              {data.contacts.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No linked contacts</p>
              ) : (
                <div className="space-y-1">
                  {data.contacts
                    .sort((a, b) => (b.contact.compositeScore || 0) - (a.contact.compositeScore || 0))
                    .map((cl) => (
                      <Link
                        key={cl.id}
                        href={`/contacts/${cl.contact.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          (cl.contact.compositeScore || 0) >= 60 ? "bg-amber-100 text-amber-700" :
                          (cl.contact.compositeScore || 0) >= 35 ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {cl.contact.compositeScore ?? "—"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#C4A265]">
                            {cl.contact.fullName}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {cl.contact.title || cl.role || "Unknown role"}
                            {cl.contact.organization ? ` · ${cl.contact.organization.name}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {cl.contact.phone && <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center"><Phone className="h-2.5 w-2.5 text-emerald-500" /></div>}
                          {cl.contact.email && <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center"><Mail className="h-2.5 w-2.5 text-blue-500" /></div>}
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </div>

            {/* Organizations */}
            {data.organizations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Organizations</h3>
                <div className="space-y-1">
                  {data.organizations.map((ol) => (
                    <div key={ol.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-700">{ol.organization.name}</span>
                      {ol.relationship && <span className="text-[10px] text-gray-400">· {ol.relationship}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
