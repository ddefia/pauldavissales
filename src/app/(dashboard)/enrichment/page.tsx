"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import Link from "next/link";

interface EnrichedContact {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  status: string;
  lastEnrichedAt: string | null;
  organization: { name: string; orgType: string | null } | null;
  territory: { name: string } | null;
  enrichmentBrief: {
    summary: string;
    pain_triggers: string[];
    personalization_hooks: string[];
    recommended_approach: string[];
    warm_lead_score_rationale: string;
    warm_lead_score?: number;
    company_intel?: {
      estimated_size: string;
      specialization: string;
    };
    competitive_landscape?: string;
    best_time_to_call?: string;
  } | null;
}

interface BatchStatus {
  running: boolean;
  success: number;
  failed: number;
  total: number;
  errors: string[];
  message?: string;
}

export default function EnrichmentPage() {
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ enrichedCount: 0, pendingCount: 0 });
  const [batchSize, setBatchSize] = useState(10);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  function loadData() {
    setLoading(true);
    fetch("/api/enrichment?limit=50")
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.data?.contacts || []);
        setStats({
          enrichedCount: d.data?.enrichedCount || 0,
          pendingCount: d.data?.pendingCount || 0,
        });
        // Check if a batch is running from the server
        if (d.data?.batchStatus?.running) {
          setBatchStatus(d.data.batchStatus);
          setEnriching(true);
          startPolling();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/enrichment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkStatus: true }),
        });
        const d = await res.json();
        const status = d.data as BatchStatus;
        setBatchStatus(status);

        if (!status.running) {
          // Batch finished
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setEnriching(false);
          loadData(); // Refresh the list
        }
      } catch {}
    }, 3000); // Poll every 3 seconds
  }

  async function enrichAll() {
    setEnriching(true);
    setBatchStatus(null);
    try {
      const res = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, batchSize }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBatchStatus({ running: false, success: 0, failed: 0, total: 0, errors: [d.error || `HTTP ${res.status}`] });
        setEnriching(false);
        return;
      }
      setBatchStatus(d.data);
      if (d.data?.running) {
        startPolling();
      } else {
        // Already done (0 contacts or immediate result)
        setEnriching(false);
        loadData();
      }
    } catch (err: any) {
      setBatchStatus({ running: false, success: 0, failed: 0, total: 0, errors: [err?.message || "Failed to start enrichment"] });
      setEnriching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enrichment</h1>
          <p className="text-sm text-gray-500">
            AI-powered research briefs for your contacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value))}
            className="rounded-md border px-2 py-2 text-sm"
            disabled={enriching}
          >
            <option value={5}>5 per batch</option>
            <option value={10}>10 per batch</option>
            <option value={25}>25 per batch</option>
            <option value={50}>50 per batch</option>
          </select>
          <Button onClick={enrichAll} disabled={enriching}>
            {enriching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Brain className="mr-2 h-4 w-4" />
            )}
            {enriching ? "Enriching..." : "Enrich Next Batch"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Enriched</p>
            <p className="text-2xl font-bold text-green-600">{stats.enrichedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Pending Enrichment</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Batch Size</p>
            <p className="text-2xl font-bold">{batchSize}</p>
            <p className="text-xs text-gray-400">~30 sec per contact</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Batch Progress */}
      {batchStatus && (
        <Card className={
          batchStatus.running
            ? "bg-blue-50 border-blue-200"
            : batchStatus.failed > 0
              ? "bg-red-50 border-red-200"
              : "bg-green-50 border-green-200"
        }>
          <CardContent className="p-4">
            {batchStatus.running ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">
                    Enrichment in progress...
                  </p>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${batchStatus.total > 0 ? ((batchStatus.success + batchStatus.failed) / batchStatus.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-blue-600">
                  {batchStatus.success + batchStatus.failed} / {batchStatus.total} completed
                  {batchStatus.success > 0 && <span className="text-green-600 ml-2">{batchStatus.success} enriched</span>}
                  {batchStatus.failed > 0 && <span className="text-red-600 ml-2">{batchStatus.failed} failed</span>}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Enrichment batch complete:</p>
                <p className="text-sm text-gray-600">
                  <span className="text-green-600 font-medium">{batchStatus.success} enriched</span>
                  {batchStatus.failed > 0 && (
                    <span className="text-red-600 font-medium"> · {batchStatus.failed} failed</span>
                  )}
                </p>
                {batchStatus.errors && batchStatus.errors.length > 0 && (
                  <div className="mt-2 border-t border-red-200 pt-2">
                    <p className="text-xs font-medium text-red-700 mb-1">Error details (first 5):</p>
                    <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                      {batchStatus.errors.slice(0, 5).map((e: string, i: number) => (
                        <li key={i} className="font-mono break-all">{e}</li>
                      ))}
                    </ul>
                    {batchStatus.errors.length > 5 && (
                      <p className="text-xs text-red-400 mt-1">... and {batchStatus.errors.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enriched Contacts */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">No enriched contacts yet</h3>
            <p className="text-sm text-gray-500">
              Import and validate contacts first, then click &quot;Enrich Next Batch&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => {
            const isExpanded = expandedId === contact.id;
            const brief = contact.enrichmentBrief;

            return (
              <Card key={contact.id}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : contact.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <div>
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="font-medium text-[#1a1a1a] hover:text-[#C4A265]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {contact.fullName}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {contact.title ?? ""}{" "}
                          {contact.organization
                            ? `at ${contact.organization.name}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {contact.status}
                      </Badge>
                      {contact.lastEnrichedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(contact.lastEnrichedAt).toLocaleDateString()}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Summary always visible */}
                  {brief && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {brief.summary}
                    </p>
                  )}

                  {/* Expanded details */}
                  {isExpanded && brief && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Company Intel + Score Row */}
                      <div className="flex gap-4">
                        {brief.company_intel && (
                          <div className="flex-1 rounded bg-gray-50 p-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Company Intel</h4>
                            <p className="text-sm text-gray-700">{brief.company_intel.estimated_size} — {brief.company_intel.specialization}</p>
                          </div>
                        )}
                        {brief.warm_lead_score != null && (
                          <div className="rounded bg-green-50 p-3 text-center min-w-[80px]">
                            <p className="text-2xl font-bold text-green-700">{brief.warm_lead_score}</p>
                            <p className="text-[10px] text-green-600">Lead Score</p>
                          </div>
                        )}
                        {brief.best_time_to_call && (
                          <div className="rounded bg-blue-50 p-3 min-w-[120px]">
                            <h4 className="text-[10px] font-semibold text-blue-500 uppercase">Best Time</h4>
                            <p className="text-xs text-blue-800">{brief.best_time_to_call}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Pain Triggers */}
                        <div>
                          <h4 className="text-sm font-semibold text-red-700 mb-1">
                            Pain Triggers
                          </h4>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {brief.pain_triggers.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Personalization Hooks */}
                        <div>
                          <h4 className="text-sm font-semibold text-blue-700 mb-1">
                            Personalization Hooks
                          </h4>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {brief.personalization_hooks.map((h, i) => (
                              <li key={i}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Recommended Approach */}
                      <div>
                        <h4 className="text-sm font-semibold text-green-700 mb-1">
                          Recommended Approach
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {brief.recommended_approach.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Competitive Landscape */}
                      {brief.competitive_landscape && (
                        <div>
                          <h4 className="text-sm font-semibold text-purple-700 mb-1">
                            Competitive Landscape
                          </h4>
                          <p className="text-sm text-gray-600">
                            {brief.competitive_landscape}
                          </p>
                        </div>
                      )}

                      {/* Score Rationale */}
                      <div className="rounded bg-purple-50 p-3">
                        <h4 className="text-sm font-semibold text-purple-800 mb-1">
                          Warm Lead Assessment
                        </h4>
                        <p className="text-sm text-gray-700">
                          {brief.warm_lead_score_rationale}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
