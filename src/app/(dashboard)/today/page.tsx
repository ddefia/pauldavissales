"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  MapPin,
  Loader2,
  Brain,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface ScoredContact {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  phoneMobile: string | null;
  status: string;
  fitScore: number | null;
  triggerScore: number | null;
  reachabilityScore: number | null;
  compositeScore: number | null;
  lastScoredAt: string | null;
  organization: { name: string; orgType: string | null } | null;
  territory: { name: string } | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  call_mobile: { label: "Call Mobile", color: "bg-green-100 text-green-800" },
  email_then_call: { label: "Email + Call", color: "bg-blue-100 text-blue-800" },
  call_office: { label: "Call Office", color: "bg-emerald-100 text-emerald-800" },
  email_sequence: { label: "Email Sequence", color: "bg-indigo-100 text-indigo-800" },
  nurture_email: { label: "Nurture", color: "bg-amber-100 text-amber-800" },
  drop_by: { label: "Drop By", color: "bg-orange-100 text-orange-800" },
  low_priority_nurture: { label: "Low Priority", color: "bg-gray-100 text-gray-700" },
};

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const val = score ?? 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-500">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="w-8 text-right font-medium">{val}</span>
    </div>
  );
}

export default function TodayPage() {
  const [contacts, setContacts] = useState<ScoredContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [talkTrack, setTalkTrack] = useState<any>(null);
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
  const [generatingTrack, setGeneratingTrack] = useState<string | null>(null);

  function loadQueue() {
    setLoading(true);
    fetch("/api/scoring?limit=25&minScore=1")
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.data?.contacts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function scoreAll() {
    setScoring(true);
    await fetch("/api/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    loadQueue();
    setScoring(false);
  }

  async function loadTalkTrack(contactId: string) {
    setLoadingTrack(contactId);
    const res = await fetch(`/api/talk-tracks?contactId=${contactId}`);
    const d = await res.json();
    setTalkTrack(d.data);
    setLoadingTrack(null);
  }

  async function generateTalkTrack(contactId: string) {
    setGeneratingTrack(contactId);
    const res = await fetch("/api/talk-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const d = await res.json();
    setTalkTrack({ content: d.data });
    setGeneratingTrack(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today&apos;s Queue</h1>
          <p className="text-sm text-gray-500">
            Your top-ranked leads, ready to work.{" "}
            {contacts.length > 0 && `${contacts.length} leads scored.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={scoreAll} disabled={scoring}>
            {scoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="mr-2 h-4 w-4" />
            )}
            {scoring ? "Scoring..." : "Re-Score All"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">No scored leads yet</h3>
            <p className="text-sm text-gray-500">
              Import, validate, and enrich contacts first, then score them to build your queue.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact, idx) => {
            const isExpanded = expandedId === contact.id;
            const composite = contact.compositeScore ?? 0;
            const tierColor =
              composite >= 75
                ? "border-l-green-500"
                : composite >= 50
                ? "border-l-blue-500"
                : composite >= 30
                ? "border-l-amber-500"
                : "border-l-gray-300";

            return (
              <Card key={contact.id} className={`border-l-4 ${tierColor}`}>
                <CardContent className="p-4">
                  {/* Main row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedId(null);
                        setTalkTrack(null);
                      } else {
                        setExpandedId(contact.id);
                        loadTalkTrack(contact.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/contacts/${contact.id}`}
                            className="font-medium text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.fullName}
                          </Link>
                          <span className="text-2xl font-bold text-gray-900">
                            {composite}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {contact.title ?? ""}{" "}
                          {contact.organization
                            ? `at ${contact.organization.name}`
                            : ""}
                          {contact.territory
                            ? ` | ${contact.territory.name}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Quick contact actions */}
                      {contact.phoneMobile && (
                        <a
                          href={`tel:${contact.phoneMobile}`}
                          className="text-green-600 hover:text-green-800"
                          onClick={(e) => e.stopPropagation()}
                          title="Call mobile"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {contact.phone && !contact.phoneMobile && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                          title="Call office"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                          title="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      {/* Score breakdown */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <ScoreBar label="Fit" score={contact.fitScore} color="bg-blue-500" />
                          <ScoreBar label="Trigger" score={contact.triggerScore} color="bg-red-500" />
                          <ScoreBar label="Reachability" score={contact.reachabilityScore} color="bg-green-500" />
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span>{contact.phone || "No phone"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-green-500" />
                            <span>{contact.phoneMobile || "No mobile"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span>{contact.email || "No email"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Talk Track Section */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Talk Track
                          </h4>
                          {!talkTrack && loadingTrack !== contact.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateTalkTrack(contact.id);
                              }}
                              disabled={generatingTrack === contact.id}
                            >
                              {generatingTrack === contact.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Brain className="mr-1 h-3 w-3" />
                              )}
                              Generate
                            </Button>
                          )}
                        </div>

                        {loadingTrack === contact.id && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading talk track...
                          </div>
                        )}

                        {generatingTrack === contact.id && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating personalized talk track...
                          </div>
                        )}

                        {talkTrack?.content && expandedId === contact.id && (
                          <div className="space-y-3 text-sm">
                            {/* Opener */}
                            <div className="rounded bg-green-50 p-3">
                              <p className="font-semibold text-green-800 text-xs uppercase mb-1">
                                30-Second Opener
                              </p>
                              <p className="text-gray-700">
                                {talkTrack.content.opener_30sec}
                              </p>
                            </div>

                            {/* Discovery Questions */}
                            <div>
                              <p className="font-semibold text-xs uppercase text-gray-500 mb-1">
                                Discovery Questions
                              </p>
                              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                                {talkTrack.content.discovery_questions?.map(
                                  (q: string, i: number) => (
                                    <li key={i}>{q}</li>
                                  )
                                )}
                              </ol>
                            </div>

                            {/* Objection Handlers */}
                            <div>
                              <p className="font-semibold text-xs uppercase text-gray-500 mb-1">
                                Objection Handlers
                              </p>
                              <div className="space-y-2">
                                {talkTrack.content.objection_handlers?.map(
                                  (o: any, i: number) => (
                                    <div
                                      key={i}
                                      className="rounded border p-2"
                                    >
                                      <p className="font-medium text-red-700">
                                        &ldquo;{o.objection}&rdquo;
                                      </p>
                                      <p className="text-gray-600 mt-1">
                                        {o.response}
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            {/* Voicemail */}
                            <div className="rounded bg-amber-50 p-3">
                              <p className="font-semibold text-amber-800 text-xs uppercase mb-1">
                                Voicemail Script
                              </p>
                              <p className="text-gray-700">
                                {talkTrack.content.voicemail_script}
                              </p>
                            </div>

                            {/* Follow-up Email */}
                            {talkTrack.content.follow_up_email && (
                              <div className="rounded bg-blue-50 p-3">
                                <p className="font-semibold text-blue-800 text-xs uppercase mb-1">
                                  Follow-Up Email
                                </p>
                                <p className="font-medium text-gray-700">
                                  Subject: {talkTrack.content.follow_up_email.subject}
                                </p>
                                <p className="text-gray-600 mt-1 whitespace-pre-line">
                                  {talkTrack.content.follow_up_email.body}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {talkTrack === null &&
                          loadingTrack !== contact.id &&
                          generatingTrack !== contact.id &&
                          expandedId === contact.id && (
                            <p className="text-sm text-gray-500">
                              No talk track yet. Click Generate to create one.
                            </p>
                          )}
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
