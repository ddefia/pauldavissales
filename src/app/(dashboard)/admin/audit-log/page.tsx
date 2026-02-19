"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  IMPORT: "bg-purple-100 text-purple-800",
  MERGE: "bg-amber-100 text-amber-800",
  VALIDATE: "bg-cyan-100 text-cyan-800",
  ENRICH: "bg-indigo-100 text-indigo-800",
  SCORE: "bg-orange-100 text-orange-800",
  GENERATE_PDF: "bg-pink-100 text-pink-800",
  GENERATE_TALK_TRACK: "bg-violet-100 text-violet-800",
  FIND_LEAD: "bg-teal-100 text-teal-800",
  LOGIN: "bg-gray-100 text-gray-800",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");

  function loadLogs(p: number = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "30" });
    if (filterAction) params.set("action", filterAction);
    if (filterEntity) params.set("entityType", filterEntity);

    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.data?.logs || []);
        setTotal(d.data?.total || 0);
        setTotalPages(d.data?.pages || 1);
        setPage(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadLogs();
  }, [filterAction, filterEntity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-gray-500">
          Full activity trail for compliance and governance ({total} entries)
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="IMPORT">Import</option>
          <option value="MERGE">Merge</option>
          <option value="VALIDATE">Validate</option>
          <option value="ENRICH">Enrich</option>
          <option value="SCORE">Score</option>
          <option value="GENERATE_PDF">Generate PDF</option>
          <option value="GENERATE_TALK_TRACK">Generate Talk Track</option>
          <option value="FIND_LEAD">Find Lead</option>
          <option value="LOGIN">Login</option>
        </select>
        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Entities</option>
          <option value="contact">Contact</option>
          <option value="organization">Organization</option>
          <option value="property">Property</option>
          <option value="import_batch">Import</option>
          <option value="user">User</option>
          <option value="talk_track">Talk Track</option>
          <option value="generated_pdf">PDF</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Log Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">No audit entries yet</h3>
            <p className="text-sm text-gray-500">
              Activity will be logged as users interact with the system.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.user.name}</span>
                      <Badge className={ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {log.entityType}
                      </Badge>
                      <span className="text-xs text-gray-400 font-mono">{log.entityId.slice(0, 8)}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-1">
                        {typeof log.details === "string"
                          ? log.details
                          : JSON.stringify(log.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadLogs(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadLogs(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
