"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Loader2,
  Phone,
  Mail,
  Building2,
  MapPin,
  Target,
  Flame,
  MessageSquare,
  Printer,
  Zap,
  Clock,
  Shield,
  Users,
  TrendingUp,
  ArrowLeft,
  Brain,
  BarChart3,
  CheckCircle2,
  XCircle,
  Globe,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface PreCallReport {
  contact: {
    id: string;
    fullName: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    organization: { name: string; orgType: string | null } | null;
    territory: { name: string } | null;
    properties: {
      id: string;
      name: string;
      propertyType: string | null;
      city: string;
      state: string;
      unitCount: number | null;
      yearBuilt: number | null;
    }[];
  };
  enrichment: any;
  scores: {
    compositeScore: number | null;
    fitScore: number | null;
    triggerScore: number | null;
    reachabilityScore: number | null;
  } | null;
  talkTrack: any;
  steps: { step: string; status: string; duration?: number }[];
  generatedAt: string;
}

interface ListContact {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  compositeScore: number | null;
  fitScore: number | null;
  triggerScore: number | null;
  reachabilityScore: number | null;
  lastEnrichedAt: string | null;
  talkTrackId: string | null;
  organization: { name: string; orgType: string | null } | null;
  territory: { name: string } | null;
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={4} strokeDasharray={circumference}
          strokeDashoffset={circumference - progress} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{score}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const val = score ?? 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="w-6 text-right font-medium text-[10px]">{val}</span>
    </div>
  );
}

export default function PreCallReportPage() {
  const [contacts, setContacts] = useState<ListContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [report, setReport] = useState<PreCallReport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadContacts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (searchDebounced) params.set("search", searchDebounced);

    fetch(`/api/pre-call-report?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.data?.contacts || []);
        setTotal(d.pagination?.total ?? 0);
        setTotalPages(d.pagination?.totalPages ?? 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, searchDebounced]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function generateReport(contactId: string) {
    setGenerating(contactId);
    setReport(null);
    setError(null);

    try {
      const res = await fetch("/api/pre-call-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || `Generation failed (HTTP ${res.status})`);
      } else if (d.data) {
        setReport(d.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to generate report");
    }
    setGenerating(null);
  }

  // ─── REPORT VIEW ───────────────────────────────────────────────────
  if (report) {
    const e = report.enrichment;
    const tt = report.talkTrack;
    const s = report.scores;
    const totalTime = report.steps.reduce((a, s) => a + (s.duration || 0), 0);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setReport(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={() => generateReport(report.contact.id)} disabled={!!generating}>
              <Zap className="h-4 w-4 mr-1" /> Regenerate
            </Button>
          </div>
        </div>

        {/* Generation stats */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 print:hidden">
          <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
          <span>&middot;</span>
          <span>{(totalTime / 1000).toFixed(0)}s total</span>
          {report.steps.map((step) => (
            <Badge
              key={step.step}
              variant={step.status === "failed" ? "destructive" : "outline"}
              className="text-[10px]"
            >
              {step.status === "failed" ? <XCircle className="h-2.5 w-2.5 mr-0.5" /> : <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
              {step.step.replaceAll("_", " ")} {step.duration ? `${(step.duration / 1000).toFixed(0)}s` : ""}
            </Badge>
          ))}
        </div>

        {/* Contact Header */}
        <Card className="bg-gradient-to-r from-slate-50 to-gray-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{report.contact.fullName}</h1>
                <p className="text-gray-600">
                  {report.contact.title || "Decision Maker"}
                  {report.contact.organization && <> at <span className="font-medium">{report.contact.organization.name}</span></>}
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  {report.contact.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {report.contact.email}</span>
                  )}
                  {report.contact.phone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {report.contact.phone}</span>
                  )}
                  {report.contact.territory && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {report.contact.territory.name}</span>
                  )}
                </div>
                {report.contact.properties.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {report.contact.properties.map((p) => (
                      <Badge key={p.id} variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {p.name} ({p.unitCount || "?"} units{p.yearBuilt ? `, ${p.yearBuilt}` : ""})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {s?.compositeScore != null && (
                <div className="text-center shrink-0">
                  <ScoreRing score={s.compositeScore} size={80} />
                  <p className="text-xs text-gray-500 mt-1">Lead Score</p>
                  <div className="mt-2 space-y-1 w-32">
                    <ScoreBar label="Fit" score={s.fitScore} color="bg-blue-500" />
                    <ScoreBar label="Trigger" score={s.triggerScore} color="bg-red-500" />
                    <ScoreBar label="Reach" score={s.reachabilityScore} color="bg-green-500" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Intelligence */}
          <div className="space-y-4">
            {e?.summary && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3 text-blue-600" /> Intelligence Summary
                  </h3>
                  <p className="text-sm text-gray-700">{e.summary}</p>
                </CardContent>
              </Card>
            )}

            {e?.company_intel && (
              <Card className="border-indigo-100">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                    <Globe className="h-3 w-3 text-indigo-600" /> Company Intel
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Object.entries(e.company_intel).map(([key, val]) => (
                      <div key={key}>
                        <p className="text-[10px] text-gray-400 uppercase">{key.replaceAll("_", " ")}</p>
                        <p className="font-medium text-gray-800">{val as string}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {e?.pain_triggers?.length > 0 && (
              <Card className="border-red-100">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Pain Triggers
                  </h3>
                  <ul className="space-y-1.5">
                    {e.pain_triggers.map((t: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5 text-xs">*</span> {t}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {e?.property_risk_assessment?.length > 0 && (
              <Card className="border-amber-100">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Property Risk
                  </h3>
                  <div className="space-y-2">
                    {e.property_risk_assessment.map((p: any, i: number) => (
                      <div key={i} className="rounded border p-2 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{p.property_name}</span>
                          <Badge variant={p.risk_level === "HIGH" ? "destructive" : p.risk_level === "MEDIUM" ? "secondary" : "outline"} className="text-[10px]">
                            {p.risk_level}
                          </Badge>
                        </div>
                        {p.estimated_annual_exposure && <p className="text-xs text-gray-500">{p.estimated_annual_exposure}</p>}
                        {p.primary_risks?.map((r: string, j: number) => (
                          <p key={j} className="text-xs text-gray-600">- {r}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {e?.competitive_landscape && (
              <Card className="border-purple-100">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Competitive Landscape
                  </h3>
                  <p className="text-sm text-gray-700">{e.competitive_landscape}</p>
                </CardContent>
              </Card>
            )}

            {e?.personalization_hooks?.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Personalization Hooks</h3>
                  <ul className="space-y-1">
                    {e.personalization_hooks.map((h: string, i: number) => (
                      <li key={i} className="text-sm text-blue-900 flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5 text-xs">*</span> {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              {e?.best_time_to_call && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Best Time</p>
                    <p className="text-sm font-medium text-gray-800 mt-1">{e.best_time_to_call}</p>
                  </CardContent>
                </Card>
              )}
              {e?.warm_lead_score != null && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-purple-600 uppercase tracking-wide font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3" /> AI Confidence</p>
                    <p className="text-2xl font-bold text-purple-700 mt-1">{e.warm_lead_score}<span className="text-xs font-normal text-gray-400">/100</span></p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right: Talk Track */}
          <div className="space-y-4">
            {tt ? (
              <>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> 30-Second Opener
                    </h3>
                    <p className="text-sm text-green-900">{tt.opener_30sec}</p>
                  </CardContent>
                </Card>

                {tt.discovery_questions?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-blue-600" /> Discovery Questions
                      </h3>
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
                        {tt.discovery_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                      </ol>
                    </CardContent>
                  </Card>
                )}

                {tt.value_propositions?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Value Propositions</h3>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {tt.value_propositions.map((v: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5 text-xs">+</span> {v}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {tt.objection_handlers?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Objection Handlers</h3>
                      <div className="space-y-2">
                        {tt.objection_handlers.map((o: any, i: number) => (
                          <div key={i} className="rounded-lg border p-3 text-sm">
                            <p className="font-medium text-red-700">&ldquo;{o.objection}&rdquo;</p>
                            <p className="text-gray-600 mt-1">{o.response}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {tt.voicemail_script && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Voicemail Script</h3>
                      <p className="text-sm text-amber-900">{tt.voicemail_script}</p>
                    </CardContent>
                  </Card>
                )}

                {tt.follow_up_email && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Follow-Up Email</h3>
                      <p className="text-sm font-medium text-blue-900">Subject: {tt.follow_up_email.subject}</p>
                      <p className="text-sm text-blue-800 mt-2 whitespace-pre-line">{tt.follow_up_email.body}</p>
                    </CardContent>
                  </Card>
                )}

                {tt.next_steps?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Next Steps</h3>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {tt.next_steps.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-blue-500 font-bold text-xs">{i + 1}.</span> {s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Talk track generation failed</p>
                  <p className="text-xs text-gray-400 mt-1">Try regenerating the report</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── CONTACT LIST VIEW ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pre-Call Reports</h1>
        <p className="text-sm text-gray-500">
          Pick any contact and generate a full call package — AI research, scoring, and talk track — in one click
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, company, title, or email..."
          className="w-full rounded-md border px-3 py-2 pl-9 text-sm"
        />
      </div>

      {/* Generating overlay */}
      {generating && (
        <Card className="border-gray-300 bg-gradient-to-br from-gray-50 to-amber-50/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#C4A265]" />
              </div>
              <div>
                <p className="font-semibold text-[#1a1a1a]">Generating Pre-Call Report</p>
                <p className="text-sm text-gray-500">
                  Running AI research, scoring, and talk track generation — this takes about 60 seconds
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm text-red-700 font-medium">Generation failed</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      {!loading && (
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{total} contacts</span>
          <span>&middot;</span>
          <span>Page {page} of {totalPages}</span>
        </div>
      )}

      {/* Contact List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-3 w-64 bg-gray-100 rounded" />
                  </div>
                  <div className="h-9 w-32 bg-gray-200 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">
              {searchQuery ? "No contacts match your search" : "No contacts imported yet"}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery
                ? "Try a different search term"
                : "Import contacts first, then generate reports here."}
            </p>
            {!searchQuery && (
              <Link href="/imports" className="text-gray-600 hover:text-[#C4A265] hover:underline text-sm mt-3">
                Go to Imports
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const isEnriched = !!contact.lastEnrichedAt;
            const hasReport = !!contact.talkTrackId;

            return (
              <Card key={contact.id} className="hover:shadow-sm transition-all hover:border-gray-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Score or status circle */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: contact.compositeScore != null
                            ? contact.compositeScore >= 70 ? "linear-gradient(135deg, #dcfce7, #bbf7d0)"
                              : contact.compositeScore >= 40 ? "linear-gradient(135deg, #fef9c3, #fde68a)"
                              : "linear-gradient(135deg, #fee2e2, #fecaca)"
                            : isEnriched
                              ? "linear-gradient(135deg, #ede9fe, #ddd6fe)"
                              : "#f3f4f6"
                        }}
                      >
                        {contact.compositeScore != null ? (
                          <span className={`text-lg font-bold ${
                            contact.compositeScore >= 70 ? "text-green-700"
                              : contact.compositeScore >= 40 ? "text-amber-700"
                              : "text-red-700"
                          }`}>{contact.compositeScore}</span>
                        ) : isEnriched ? (
                          <Sparkles className="h-5 w-5 text-purple-500" />
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/contacts/${contact.id}`} className="font-medium hover:text-[#C4A265] hover:underline">
                            {contact.fullName}
                          </Link>
                          {hasReport && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Has Report
                            </Badge>
                          )}
                          {isEnriched && !hasReport && (
                            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Enriched
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {contact.title || ""}{contact.organization ? ` at ${contact.organization.name}` : ""}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {contact.email && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {contact.email}</span>}
                          {contact.territory && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {contact.territory.name}</span>}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => generateReport(contact.id)}
                      disabled={!!generating}
                      className="shrink-0"
                    >
                      {generating === contact.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      {generating === contact.id ? "Generating..." : hasReport ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
