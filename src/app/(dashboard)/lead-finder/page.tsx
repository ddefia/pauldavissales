"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, UserPlus, Check, Lightbulb, Brain, Sparkles } from "lucide-react";
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

const QUICK_SEARCHES = [
  "Property management companies in Palm Beach County with 50+ unit buildings",
  "HOA and COA boards in Jupiter and Tequesta managing coastal condos",
  "High-rise building managers in West Palm Beach and Boca Raton",
  "Commercial property owners in Martin County near the coast",
  "New condo developments in St. Lucie County breaking ground this year",
];

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
      <div>
        <h1 className="text-2xl font-bold">Lead Finder</h1>
        <p className="text-sm text-gray-500">
          AI-powered prospecting — describe who you want to reach and get new leads
        </p>
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
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
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

      {/* Results */}
      {searching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Searching for leads...</span>
        </div>
      )}

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
                          <span className="font-medium text-base">{lead.fullName}</span>
                          <Badge variant="outline" className="text-xs">
                            {lead.orgType.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          {lead.title} at <span className="font-medium">{lead.organizationName}</span>
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                          {lead.email && <span>📧 {lead.email}</span>}
                          {lead.phone && <span>📞 {lead.phone}</span>}
                          <span>📍 {lead.city}, {lead.state} {lead.zipCode}</span>
                          {lead.propertyName && (
                            <span>🏢 {lead.propertyName} ({lead.propertyType?.replace("_", " ")})</span>
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
                              className="text-xs text-blue-600 hover:underline"
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
