"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Loader2, Mail, Phone } from "lucide-react";

interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  warnings: number;
  byType: { type: string; status: string; count: number }[];
}

export default function ValidationPage() {
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  function loadStats() {
    setLoading(true);
    fetch("/api/validation")
      .then((r) => r.json())
      .then((d) => { setStats(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadStats(); }, []);

  async function runAll() {
    setRunning(true);
    const res = await fetch("/api/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const d = await res.json();
    setLastResult(d.data);
    setRunning(false);
    loadStats();
  }

  const totalChecks = stats?.total ?? 0;
  const validPct = totalChecks > 0 ? Math.round(((stats?.valid ?? 0) / totalChecks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Validation</h1>
          <p className="text-sm text-gray-500">Email and phone validation results</p>
        </div>
        <Button onClick={runAll} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {running ? "Running..." : "Validate All Unvalidated"}
        </Button>
      </div>

      {lastResult && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Validation run complete:</p>
            <p className="text-sm text-gray-600">
              {lastResult.processed} contacts processed &middot;{" "}
              <span className="text-green-600">{lastResult.valid} valid</span> &middot;{" "}
              <span className="text-red-600">{lastResult.invalid} invalid</span> &middot;{" "}
              <span className="text-amber-600">{lastResult.warnings} warnings</span>
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 animate-pulse rounded bg-gray-200" /></CardContent></Card>
          ))}
        </div>
      ) : !stats || totalChecks === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheck className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">No validation data yet</h3>
            <p className="text-sm text-gray-500">Import contacts first, then run validation.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-500">Total Checks</p>
                <p className="text-2xl font-bold">{totalChecks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-500">Valid</p>
                <p className="text-2xl font-bold text-green-600">{stats.valid}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-500">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{stats.invalid}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-500">Warnings</p>
                <p className="text-2xl font-bold text-amber-600">{stats.warnings}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Overall Pass Rate</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={validPct} className="flex-1" />
                <span className="text-lg font-bold">{validPct}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Results by Type</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.byType.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-2">
                      {item.type.startsWith("EMAIL") ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      <span className="text-sm font-medium">{item.type.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{item.count}</span>
                      <Badge variant={
                        item.status === "VALID" ? "default" :
                        item.status === "WARN" ? "secondary" : "destructive"
                      }>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
