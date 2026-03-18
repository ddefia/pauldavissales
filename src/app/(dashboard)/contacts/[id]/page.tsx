"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  ShieldCheck,
  Brain,
  FileText,
  BarChart3,
  Loader2,
  Zap,
  Flame,
  Shield,
  TrendingUp,
  Clock,
  Users,
  Target,
  MessageSquare,
  Globe,
  Home,
} from "lucide-react";

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const val = score ?? 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-gray-500">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="w-8 text-right font-medium">{val}</span>
    </div>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={5} strokeDasharray={circumference}
          strokeDashoffset={circumference - progress} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{score}</span>
        <span className="text-[9px] text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

// Skeleton loader
function ContactSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-16 bg-gray-200 rounded" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-40 bg-gray-200 rounded-lg" />
          <div className="h-32 bg-gray-200 rounded-lg" />
          <div className="h-24 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [talkTrack, setTalkTrack] = useState<any>(null);
  const [generatingTrack, setGeneratingTrack] = useState(false);
  const [enrichBrief, setEnrichBrief] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  function loadContact() {
    fetch(`/api/contacts/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setContact(d.data);
        setLoading(false);
        if (d.data?.enrichmentBrief) {
          try {
            setEnrichBrief(
              typeof d.data.enrichmentBrief === "string"
                ? JSON.parse(d.data.enrichmentBrief)
                : d.data.enrichmentBrief
            );
          } catch {
            setEnrichBrief(null);
          }
        }
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadContact();
    fetch(`/api/talk-tracks?contactId=${params.id}`)
      .then((r) => r.json())
      .then((d) => setTalkTrack(d.data))
      .catch(() => {});
  }, [params.id]);

  async function runValidation() {
    setValidating(true);
    await fetch("/api/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [params.id] }),
    });
    const res = await fetch(`/api/contacts/${params.id}`);
    const d = await res.json();
    setContact(d.data);
    setValidating(false);
  }

  async function runEnrichment() {
    setEnriching(true);
    try {
      const res = await fetch("/api/enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: params.id }),
      });
      const d = await res.json();
      if (d.data) setEnrichBrief(d.data);
      loadContact();
    } catch {}
    setEnriching(false);
  }

  async function runScoring() {
    setScoring(true);
    await fetch("/api/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: params.id as string }),
    });
    loadContact();
    setScoring(false);
  }

  async function generateTalkTrack() {
    setGeneratingTrack(true);
    try {
      const res = await fetch("/api/talk-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: params.id }),
      });
      const d = await res.json();
      if (d.data) setTalkTrack({ content: d.data });
    } catch {}
    setGeneratingTrack(false);
  }

  async function generatePreCallReport() {
    setGeneratingReport(true);
    try {
      await fetch("/api/pre-call-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: params.id }),
      });
      router.push(`/pre-call`);
    } catch {}
    setGeneratingReport(false);
  }

  if (loading) return <ContactSkeleton />;
  if (!contact) return (
    <div className="flex flex-col items-center py-12">
      <p className="text-lg font-medium text-gray-600">Contact not found</p>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => router.push("/contacts")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contacts
      </Button>
    </div>
  );

  const validResults = contact.validationResults || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{contact.fullName}</h1>
              <Badge className="text-xs">{contact.status}</Badge>
              {contact.dataQualityScore !== null && (
                <Badge variant="outline" className="text-xs">{contact.dataQualityScore}% quality</Badge>
              )}
            </div>
            {contact.title && (
              <p className="text-sm text-gray-500">
                {contact.title}
                {contact.organization && <> at <span className="font-medium">{contact.organization.name}</span></>}
              </p>
            )}
          </div>
        </div>
        {contact.compositeScore != null && (
          <ScoreRing score={contact.compositeScore} />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={runValidation} disabled={validating}>
          {validating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
          {validating ? "Validating..." : "Validate"}
        </Button>
        <Button size="sm" variant="outline" onClick={runEnrichment} disabled={enriching}>
          {enriching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
          {enriching ? "Enriching..." : "Enrich"}
        </Button>
        <Button size="sm" variant="outline" onClick={runScoring} disabled={scoring}>
          {scoring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
          {scoring ? "Scoring..." : "Score"}
        </Button>
        <Button size="sm" variant="outline" onClick={generateTalkTrack} disabled={generatingTrack}>
          {generatingTrack ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
          {generatingTrack ? "Generating..." : "Talk Track"}
        </Button>
        <Button size="sm" onClick={generatePreCallReport} disabled={generatingReport} className="bg-[#ED1C24] hover:bg-red-700 text-white">
          {generatingReport ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
          {generatingReport ? "Generating..." : "Full Pre-Call Report"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Contact Info + Enrichment */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact Details Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Full Name</p>
                    <p className="text-sm font-medium">{[contact.prefix, contact.firstName, contact.lastName, contact.suffix].filter(Boolean).join(" ")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{contact.email ?? "—"}</p>
                      {validResults.find((v: any) => v.field === "email")?.status === "VALID" && <Badge className="text-[10px] h-4">Valid</Badge>}
                      {validResults.find((v: any) => v.field === "email")?.status === "INVALID" && <Badge variant="destructive" className="text-[10px] h-4">Invalid</Badge>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{contact.phone ?? "—"}</p>
                      {validResults.find((v: any) => v.field === "phone")?.status === "VALID" && <Badge className="text-[10px] h-4">Valid</Badge>}
                      {validResults.find((v: any) => v.field === "phone")?.status === "INVALID" && <Badge variant="destructive" className="text-[10px] h-4">Invalid</Badge>}
                    </div>
                  </div>
                  {contact.phoneMobile && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Mobile</p>
                      <p className="text-sm">{contact.phoneMobile}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</p>
                    <p className="text-sm">
                      {[contact.addressLine1, contact.addressLine2].filter(Boolean).join(", ") || "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {[contact.city, contact.state, contact.zipCode].filter(Boolean).join(", ") || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1"><Building2 className="h-3 w-3" /> Organization</p>
                    {contact.organization ? (
                      <div>
                        <p className="text-sm font-medium">{contact.organization.name}</p>
                        {contact.organization.orgType && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">{contact.organization.orgType.replaceAll("_", " ")}</Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">None</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Territory</p>
                    <p className="text-sm">{contact.territory?.name ?? "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Source</p>
                    <Badge variant="outline" className="text-[10px]">{contact.source?.replaceAll("_", " ")}</Badge>
                    {contact.importBatch && (
                      <p className="text-[10px] text-gray-400 mt-0.5">from {contact.importBatch.fileName}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Intel (from enrichment) */}
          {enrichBrief?.company_intel && (
            <Card className="border-indigo-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-600" /> Company Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Estimated Size</p>
                    <p className="text-sm font-medium">{enrichBrief.company_intel.estimated_size}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Service Area</p>
                    <p className="text-sm font-medium">{enrichBrief.company_intel.service_area}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Specialization</p>
                    <p className="text-sm font-medium">{enrichBrief.company_intel.specialization}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Decision Structure</p>
                    <p className="text-sm font-medium">{enrichBrief.company_intel.decision_structure}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enrichment Brief */}
          {enrichBrief && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" /> AI Research Brief
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">{enrichBrief.summary}</p>

                {enrichBrief.role_context && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Role Context</p>
                    <p className="text-sm text-gray-700">{enrichBrief.role_context}</p>
                  </div>
                )}

                {enrichBrief.portfolio_overview && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Portfolio Overview</p>
                    <p className="text-sm text-gray-700">{enrichBrief.portfolio_overview}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {enrichBrief.pain_triggers?.length > 0 && (
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                      <p className="text-[10px] text-red-600 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                        <Flame className="h-3 w-3" /> Pain Triggers
                      </p>
                      <ul className="space-y-1.5">
                        {enrichBrief.pain_triggers.map((t: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-red-400 mt-0.5 text-xs">*</span> {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichBrief.personalization_hooks?.length > 0 && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                        <Target className="h-3 w-3" /> Personalization Hooks
                      </p>
                      <ul className="space-y-1.5">
                        {enrichBrief.personalization_hooks.map((h: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-blue-400 mt-0.5 text-xs">*</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichBrief.recommended_approach?.length > 0 && (
                    <div className="rounded-lg border border-green-100 bg-green-50/50 p-3">
                      <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-2">Recommended Approach</p>
                      <ul className="space-y-1.5">
                        {enrichBrief.recommended_approach.map((a: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-green-400 mt-0.5 text-xs">*</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichBrief.risk_factors?.length > 0 && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Risk Factors
                      </p>
                      <ul className="space-y-1.5">
                        {enrichBrief.risk_factors.map((r: string, i: number) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5 text-xs">*</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Competitive Landscape */}
                {enrichBrief.competitive_landscape && (
                  <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                    <p className="text-[10px] text-purple-600 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Competitive Landscape
                    </p>
                    <p className="text-sm text-gray-700">{enrichBrief.competitive_landscape}</p>
                  </div>
                )}

                {/* Best Time + Warm Lead Score */}
                <div className="grid grid-cols-2 gap-4">
                  {enrichBrief.best_time_to_call && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Best Time to Call
                      </p>
                      <p className="text-sm font-medium text-gray-800">{enrichBrief.best_time_to_call}</p>
                    </div>
                  )}
                  {enrichBrief.warm_lead_score != null && (
                    <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-3">
                      <p className="text-[10px] text-purple-600 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Warm Lead Score
                      </p>
                      <p className="text-2xl font-bold text-purple-700">{enrichBrief.warm_lead_score}<span className="text-sm font-normal text-gray-400">/100</span></p>
                      {enrichBrief.warm_lead_score_rationale && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{enrichBrief.warm_lead_score_rationale}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Property Risk Assessment */}
          {enrichBrief?.property_risk_assessment?.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" /> Property Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {enrichBrief.property_risk_assessment.map((p: any, i: number) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{p.property_name}</span>
                        <Badge
                          variant={p.risk_level === "HIGH" ? "destructive" : p.risk_level === "MEDIUM" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {p.risk_level} RISK
                        </Badge>
                      </div>
                      {p.estimated_annual_exposure && (
                        <p className="text-xs text-gray-500 mb-2">Est. annual exposure: <span className="font-medium">{p.estimated_annual_exposure}</span></p>
                      )}
                      {p.primary_risks?.length > 0 && (
                        <ul className="space-y-0.5">
                          {p.primary_risks.map((r: string, j: number) => (
                            <li key={j} className="text-xs text-gray-600 flex items-start gap-1">
                              <span className="text-amber-400">-</span> {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Talk Track */}
          {talkTrack?.content && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#C4A265]" /> Talk Track
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-1">30-Second Opener</p>
                  <p className="text-sm text-gray-800">{talkTrack.content.opener_30sec}</p>
                </div>

                {talkTrack.content.discovery_questions?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Discovery Questions
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                      {talkTrack.content.discovery_questions.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {talkTrack.content.value_propositions?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Value Propositions</p>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {talkTrack.content.value_propositions.map((v: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5 text-xs">+</span> {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {talkTrack.content.objection_handlers?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Objection Handlers</p>
                    <div className="space-y-2">
                      {talkTrack.content.objection_handlers.map((o: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3 text-sm">
                          <p className="font-medium text-red-700">&ldquo;{o.objection}&rdquo;</p>
                          <p className="text-gray-600 mt-1">{o.response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {talkTrack.content.voicemail_script && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mb-1">Voicemail Script</p>
                    <p className="text-sm text-gray-800">{talkTrack.content.voicemail_script}</p>
                  </div>
                )}

                {talkTrack.content.follow_up_email && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold mb-1">Follow-Up Email</p>
                    <p className="text-sm font-medium text-gray-800">Subject: {talkTrack.content.follow_up_email.subject}</p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{talkTrack.content.follow_up_email.body}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Scores */}
          {contact.compositeScore != null && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Score Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <ScoreBar label="Fit" score={contact.fitScore} color="bg-blue-500" />
                <ScoreBar label="Trigger" score={contact.triggerScore} color="bg-red-500" />
                <ScoreBar label="Reachability" score={contact.reachabilityScore} color="bg-green-500" />
              </CardContent>
            </Card>
          )}

          {/* Properties */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="h-4 w-4" /> Properties ({contact.properties?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.properties?.length > 0 ? (
                <div className="space-y-2">
                  {contact.properties.map((cp: any) => (
                    <div key={cp.property.id} className="rounded-lg border p-2">
                      <p className="text-sm font-medium">{cp.property.name}</p>
                      {cp.role && <p className="text-[10px] text-gray-400">{cp.role}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cp.property.propertyType && (
                          <Badge variant="outline" className="text-[10px]">
                            {cp.property.propertyType.replaceAll("_", " ")}
                          </Badge>
                        )}
                        {cp.property.unitCount && (
                          <Badge variant="outline" className="text-[10px]">
                            {cp.property.unitCount} units
                          </Badge>
                        )}
                        {cp.property.yearBuilt && (
                          <Badge variant="outline" className="text-[10px]">
                            Built {cp.property.yearBuilt}
                          </Badge>
                        )}
                      </div>
                      {cp.property.city && (
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {cp.property.city}, {cp.property.state}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No properties linked</p>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Validation</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {validResults.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{v.type.replaceAll("_", " ")} ({v.field})</span>
                      <Badge
                        variant={v.status === "VALID" ? "default" : v.status === "WARN" ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
