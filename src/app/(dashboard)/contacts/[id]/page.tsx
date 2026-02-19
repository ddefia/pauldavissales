"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded" />;
  if (!contact) return <p>Contact not found.</p>;

  const validResults = contact.validationResults || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold">{contact.fullName}</h1>
        <Badge>{contact.status}</Badge>
        {contact.dataQualityScore !== null && (
          <Badge variant="outline">{contact.dataQualityScore}% quality</Badge>
        )}
        {contact.compositeScore != null && (
          <Badge variant="outline" className="bg-blue-50">
            Score: {contact.compositeScore}
          </Badge>
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
          {generatingTrack ? "Generating..." : "Generate Talk Track"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {contact.title && (
                <>
                  <span className="text-gray-500">Title</span>
                  <span>{contact.title}</span>
                </>
              )}
              <span className="text-gray-500">Name</span>
              <span>{[contact.prefix, contact.firstName, contact.lastName, contact.suffix].filter(Boolean).join(" ")}</span>

              <span className="text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
              <div className="flex items-center gap-2">
                <span>{contact.email ?? "—"}</span>
                {validResults.find((v: any) => v.field === "email")?.status === "VALID" && (
                  <Badge variant="default" className="text-xs">Valid</Badge>
                )}
                {validResults.find((v: any) => v.field === "email")?.status === "INVALID" && (
                  <Badge variant="destructive" className="text-xs">Invalid</Badge>
                )}
                {validResults.find((v: any) => v.field === "email")?.status === "WARN" && (
                  <Badge variant="secondary" className="text-xs">Warning</Badge>
                )}
              </div>

              <span className="text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
              <div className="flex items-center gap-2">
                <span>{contact.phone ?? "—"}</span>
                {validResults.find((v: any) => v.field === "phone")?.status === "VALID" && (
                  <Badge variant="default" className="text-xs">Valid</Badge>
                )}
                {validResults.find((v: any) => v.field === "phone")?.status === "INVALID" && (
                  <Badge variant="destructive" className="text-xs">Invalid</Badge>
                )}
              </div>

              {contact.phoneMobile && (
                <>
                  <span className="text-gray-500">Mobile</span>
                  <span>{contact.phoneMobile}</span>
                </>
              )}

              {contact.fax && (
                <>
                  <span className="text-gray-500">Fax</span>
                  <span>{contact.fax}</span>
                </>
              )}

              <span className="text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</span>
              <span>
                {[contact.addressLine1, contact.addressLine2, contact.city, contact.state, contact.zipCode]
                  .filter(Boolean).join(", ") || "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Scores */}
          {contact.compositeScore != null && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Lead Score</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="text-center mb-3">
                  <span className="text-3xl font-bold">{contact.compositeScore}</span>
                  <span className="text-sm text-gray-500"> / 100</span>
                </div>
                <ScoreBar label="Fit" score={contact.fitScore} color="bg-blue-500" />
                <ScoreBar label="Trigger" score={contact.triggerScore} color="bg-red-500" />
                <ScoreBar label="Reachability" score={contact.reachabilityScore} color="bg-green-500" />
              </CardContent>
            </Card>
          )}

          {/* Organization */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Organization</CardTitle></CardHeader>
            <CardContent>
              {contact.organization ? (
                <Link href={`/organizations/${contact.organization.id}`} className="text-blue-600 hover:underline">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {contact.organization.name}
                  </div>
                  {contact.organization.orgType && (
                    <Badge variant="outline" className="mt-1 text-xs">{contact.organization.orgType.replace("_", " ")}</Badge>
                  )}
                </Link>
              ) : (
                <span className="text-sm text-gray-500">No organization</span>
              )}
            </CardContent>
          </Card>

          {/* Territory */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Territory</CardTitle></CardHeader>
            <CardContent>
              <span className="text-sm">{contact.territory?.name ?? "Unassigned"}</span>
            </CardContent>
          </Card>

          {/* Properties */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
            <CardContent>
              {contact.properties?.length > 0 ? (
                <div className="space-y-2">
                  {contact.properties.map((cp: any) => (
                    <Link key={cp.property.id} href={`/properties/${cp.property.id}`}
                      className="block text-sm text-blue-600 hover:underline">
                      {cp.property.name}
                      {cp.role && <span className="text-gray-400 ml-1">({cp.role})</span>}
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-500">No properties linked</span>
              )}
            </CardContent>
          </Card>

          {/* Import Source */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Source</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <Badge variant="outline">{contact.source?.replace("_", " ")}</Badge>
              {contact.importBatch && (
                <p className="text-xs text-gray-500 mt-1">
                  from {contact.importBatch.fileName} (row {contact.sourceRowNumber})
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enrichment Brief */}
      {enrichBrief && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Enrichment Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">{enrichBrief.summary}</p>

            {enrichBrief.role_context && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-1">Role Context</h4>
                <p className="text-sm text-gray-600">{enrichBrief.role_context}</p>
              </div>
            )}

            {enrichBrief.portfolio_overview && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-1">Portfolio Overview</h4>
                <p className="text-sm text-gray-600">{enrichBrief.portfolio_overview}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {enrichBrief.pain_triggers?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-1">Pain Triggers</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {enrichBrief.pain_triggers.map((t: string, i: number) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {enrichBrief.personalization_hooks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-700 mb-1">Personalization Hooks</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {enrichBrief.personalization_hooks.map((h: string, i: number) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {enrichBrief.recommended_approach?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-1">Recommended Approach</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {enrichBrief.recommended_approach.map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {enrichBrief.risk_factors?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-1">Risk Factors</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {enrichBrief.risk_factors.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {enrichBrief.warm_lead_score_rationale && (
              <div className="rounded bg-purple-50 p-3">
                <h4 className="text-sm font-semibold text-purple-800 mb-1">Warm Lead Assessment</h4>
                <p className="text-sm text-gray-700">{enrichBrief.warm_lead_score_rationale}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Talk Track */}
      {talkTrack?.content && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Talk Track
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded bg-green-50 p-3">
              <p className="font-semibold text-green-800 text-xs uppercase mb-1">30-Second Opener</p>
              <p className="text-sm text-gray-700">{talkTrack.content.opener_30sec}</p>
            </div>

            {talkTrack.content.discovery_questions?.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-gray-500 mb-1">Discovery Questions</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  {talkTrack.content.discovery_questions.map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}

            {talkTrack.content.value_propositions?.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-gray-500 mb-1">Value Propositions</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {talkTrack.content.value_propositions.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {talkTrack.content.objection_handlers?.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-gray-500 mb-1">Objection Handlers</p>
                <div className="space-y-2">
                  {talkTrack.content.objection_handlers.map((o: any, i: number) => (
                    <div key={i} className="rounded border p-2 text-sm">
                      <p className="font-medium text-red-700">&ldquo;{o.objection}&rdquo;</p>
                      <p className="text-gray-600 mt-1">{o.response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {talkTrack.content.voicemail_script && (
              <div className="rounded bg-amber-50 p-3">
                <p className="font-semibold text-amber-800 text-xs uppercase mb-1">Voicemail Script</p>
                <p className="text-sm text-gray-700">{talkTrack.content.voicemail_script}</p>
              </div>
            )}

            {talkTrack.content.follow_up_email && (
              <div className="rounded bg-blue-50 p-3">
                <p className="font-semibold text-blue-800 text-xs uppercase mb-1">Follow-Up Email</p>
                <p className="font-medium text-sm text-gray-700">Subject: {talkTrack.content.follow_up_email.subject}</p>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{talkTrack.content.follow_up_email.body}</p>
              </div>
            )}

            {talkTrack.content.next_steps?.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-gray-500 mb-1">Next Steps</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {talkTrack.content.next_steps.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Validation Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validResults.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <span className="font-medium">{v.type.replace("_", " ")}</span>
                    <span className="text-gray-500 ml-2">({v.field})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{v.message}</span>
                    <Badge variant={v.status === "VALID" ? "default" : v.status === "WARN" ? "secondary" : "destructive"}>
                      {v.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
