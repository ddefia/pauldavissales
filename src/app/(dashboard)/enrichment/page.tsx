"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
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

interface ApolloImportResult {
  success: boolean;
  totalRows: number;
  matched: number;
  updated: number;
  unmatched: number;
  errors: number;
  orgsUpdated: number;
  details: {
    updatedContacts: { id: string; email: string; name: string }[];
    unmatchedRows: { email: string; name: string; company: string }[];
    errorRows: { email: string; error: string }[];
  };
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

  // Apollo import state
  const [apolloImporting, setApolloImporting] = useState(false);
  const [apolloResult, setApolloResult] = useState<ApolloImportResult | null>(null);
  const [apolloShowDetails, setApolloShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApolloImport = useCallback(async (file: File) => {
    setApolloImporting(true);
    setApolloResult(null);
    setApolloShowDetails(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/enrichment/apollo-import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setApolloResult({
          success: false,
          totalRows: 0,
          matched: 0,
          updated: 0,
          unmatched: 0,
          errors: 1,
          orgsUpdated: 0,
          details: {
            updatedContacts: [],
            unmatchedRows: [],
            errorRows: [{ email: "", error: data.error || `HTTP ${res.status}` }],
          },
        });
      } else {
        setApolloResult(data);
        loadData(); // Refresh enriched contacts list
      }
    } catch (err: any) {
      setApolloResult({
        success: false,
        totalRows: 0,
        matched: 0,
        updated: 0,
        unmatched: 0,
        errors: 1,
        orgsUpdated: 0,
        details: {
          updatedContacts: [],
          unmatchedRows: [],
          errorRows: [{ email: "", error: err?.message || "Import failed" }],
        },
      });
    } finally {
      setApolloImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

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

      {/* Apollo CSV Import */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-base">Apollo Enrichment Import</CardTitle>
            </div>
            <Badge variant="outline" className="text-purple-600 border-purple-300">
              CSV / XLSX
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Upload an Apollo contacts export to enrich existing contacts with phone numbers,
            LinkedIn profiles, AI research briefs, and company intel.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleApolloImport(file);
              }}
            />
            <Button
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
              onClick={() => fileInputRef.current?.click()}
              disabled={apolloImporting}
            >
              {apolloImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {apolloImporting ? "Importing..." : "Upload Apollo CSV"}
            </Button>
          </div>

          {/* Apollo Import Results */}
          {apolloResult && (
            <div
              className={`rounded-lg p-4 mt-3 ${
                apolloResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {apolloResult.success ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800">Import complete</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded bg-white p-2 text-center">
                      <p className="text-lg font-bold text-gray-900">{apolloResult.totalRows}</p>
                      <p className="text-[10px] text-gray-500">Total Rows</p>
                    </div>
                    <div className="rounded bg-white p-2 text-center">
                      <p className="text-lg font-bold text-green-600">{apolloResult.updated}</p>
                      <p className="text-[10px] text-gray-500">Contacts Updated</p>
                    </div>
                    <div className="rounded bg-white p-2 text-center">
                      <p className="text-lg font-bold text-blue-600">{apolloResult.orgsUpdated}</p>
                      <p className="text-[10px] text-gray-500">Orgs Updated</p>
                    </div>
                    <div className="rounded bg-white p-2 text-center">
                      <p className="text-lg font-bold text-amber-600">{apolloResult.unmatched}</p>
                      <p className="text-[10px] text-gray-500">Unmatched</p>
                    </div>
                  </div>

                  {/* Toggle details */}
                  <button
                    className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                    onClick={() => setApolloShowDetails(!apolloShowDetails)}
                  >
                    {apolloShowDetails ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {apolloShowDetails ? "Hide details" : "Show details"}
                  </button>

                  {apolloShowDetails && (
                    <div className="space-y-3 text-sm">
                      {apolloResult.details.unmatchedRows.length > 0 && (
                        <div>
                          <p className="font-medium text-amber-700 flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3 w-3" />
                            Unmatched ({apolloResult.details.unmatchedRows.length}) — not in your database
                          </p>
                          <div className="max-h-40 overflow-y-auto rounded bg-white p-2">
                            {apolloResult.details.unmatchedRows.slice(0, 20).map((r, i) => (
                              <p key={i} className="text-xs text-gray-600">
                                {r.name} — {r.email} ({r.company})
                              </p>
                            ))}
                            {apolloResult.details.unmatchedRows.length > 20 && (
                              <p className="text-xs text-gray-400 mt-1">
                                ...and {apolloResult.details.unmatchedRows.length - 20} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {apolloResult.details.errorRows.length > 0 && (
                        <div>
                          <p className="font-medium text-red-700 flex items-center gap-1 mb-1">
                            <XCircle className="h-3 w-3" />
                            Errors ({apolloResult.details.errorRows.length})
                          </p>
                          <div className="max-h-32 overflow-y-auto rounded bg-white p-2">
                            {apolloResult.details.errorRows.map((r, i) => (
                              <p key={i} className="text-xs text-red-600 font-mono">
                                {r.email}: {r.error}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-800">
                    {apolloResult.details.errorRows[0]?.error || "Import failed"}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
