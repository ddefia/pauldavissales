"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface DuplicateGroup {
  id: string;
  status: string;
  confidence: number;
  matchReasons: string[];
  contacts: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    organization: { name: string } | null;
    dataQualityScore: number | null;
    source: string;
    isGoldenRecord: boolean;
  }[];
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [massLoading, setMassLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [totalPending, setTotalPending] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function loadGroups() {
    setLoading(true);
    fetch("/api/duplicates?status=PENDING&pageSize=100")
      .then((r) => r.json())
      .then((d) => {
        setGroups(d.data || []);
        setTotalPending(d.pagination?.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadGroups(); }, []);

  async function handleMerge(groupId: string, winnerId: string) {
    setActionLoading(groupId);
    await fetch(`/api/duplicates/${groupId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId }),
    });
    loadGroups();
    setActionLoading(null);
  }

  async function handleDismiss(groupId: string) {
    setActionLoading(groupId);
    await fetch(`/api/duplicates/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DISMISSED" }),
    });
    loadGroups();
    setActionLoading(null);
  }

  async function massAction(action: string) {
    setMassLoading(true);
    setLastAction(null);
    try {
      const body: any = { action };
      if (action === "dismiss_selected") {
        body.groupIds = Array.from(selectedIds);
      }
      const res = await fetch("/api/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setLastAction({ type: "error", message: d.error || "Action failed" });
      } else if (action === "dismiss_all" || action === "dismiss_selected") {
        setLastAction({ type: "success", message: `Dismissed ${d.data.dismissed} duplicate groups` });
      } else if (action === "delete_all_losers") {
        setLastAction({
          type: "success",
          message: `Resolved ${d.data.groups} groups — deleted ${d.data.deleted} duplicate contacts, kept ${d.data.kept} winners`,
        });
      }
      setSelectedIds(new Set());
      loadGroups();
    } catch {
      setLastAction({ type: "error", message: "Mass action failed" });
    }
    setMassLoading(false);
  }

  function toggleSelect(groupId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === groups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(groups.map((g) => g.id)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Duplicate Resolution</h1>
          <p className="text-sm text-muted-foreground">
            {totalPending.toLocaleString()} pending duplicate groups to review
          </p>
        </div>
      </div>

      {/* Mass Action Buttons */}
      {totalPending > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Mass Actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => massAction("dismiss_all")}
                  disabled={massLoading}
                >
                  {massLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <X className="mr-2 h-3 w-3" />}
                  Dismiss All ({totalPending})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => massAction("delete_all_losers")}
                  disabled={massLoading}
                >
                  {massLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
                  Auto-Resolve All (Keep Best, Delete Dupes)
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => massAction("dismiss_selected")}
                    disabled={massLoading}
                  >
                    <X className="mr-2 h-3 w-3" />
                    Dismiss Selected ({selectedIds.size})
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === groups.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Message */}
      {lastAction && (
        <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${
          lastAction.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {lastAction.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {lastAction.message}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-24 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-medium">No pending duplicates</h3>
            <p className="text-sm text-muted-foreground">All duplicate groups have been resolved.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              className={selectedIds.has(group.id) ? "ring-2 ring-blue-500" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(group.id)}
                      onChange={() => toggleSelect(group.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Copy className="h-5 w-5 text-amber-600" />
                    <CardTitle className="text-base">
                      {Math.round(group.confidence * 100)}% match
                    </CardTitle>
                    {group.matchReasons.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleDismiss(group.id)}
                    disabled={actionLoading === group.id}
                  >
                    <X className="h-4 w-4 mr-1" /> Not Duplicates
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {group.contacts.map((c) => (
                    <div
                      key={c.id}
                      className="relative rounded-lg border p-4 hover:border-blue-500 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{c.fullName}</p>
                        {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                        <p className="text-sm">{c.email ?? "No email"}</p>
                        <p className="text-sm">{c.phone ?? "No phone"}</p>
                        {c.organization && (
                          <p className="text-xs text-muted-foreground">{c.organization.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{c.source.replace("_", " ")}</Badge>
                          {c.dataQualityScore !== null && (
                            <span className={`text-xs font-medium ${
                              c.dataQualityScore >= 70 ? "text-green-600" :
                              c.dataQualityScore >= 40 ? "text-amber-500" : "text-red-500"
                            }`}>{c.dataQualityScore}% quality</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm" className="mt-3 w-full"
                        onClick={() => handleMerge(group.id, c.id)}
                        disabled={actionLoading === group.id}
                      >
                        <Check className="h-3 w-3 mr-1" /> Keep This One
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
