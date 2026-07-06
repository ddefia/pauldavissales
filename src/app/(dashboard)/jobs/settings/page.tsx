"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ShieldCheck,
  Database,
} from "lucide-react";

interface ImportSummary {
  fileName: string;
  totalRows: number;
  matched: number;
  inserted: number;
  closed: number;
  skipped: number;
  reopened: number;
  jobNumberColumn: string | null;
  detectedColumns: Record<string, string | null>;
  unmatchedHeaders: string[];
}

export default function JobsSettingsPage() {
  return (
    <div className="space-y-5">
      <BuiltInDataCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UploadCard />
        <StatusListCard />
      </div>
    </div>
  );
}

// ─── Built-in (hardcoded) job data ───────────────────────────────────────────

function BuiltInDataCard() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; alreadyPresent: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/jobs/seed")
      .then((r) => r.json())
      .then((d) => setCount(d.data?.builtInCount ?? null))
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/jobs/seed", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
            <Database className="h-4 w-4 text-[#F26522]" /> Built-in job data
          </h2>
          <p className="text-xs text-gray-400 max-w-xl">
            {count != null ? <strong>{count.toLocaleString()} jobs</strong> : "A dataset"} are baked
            into the app and load automatically on a fresh install. Use this to pull them into the
            current workspace. It only adds jobs that aren&apos;t already here — nothing is
            overwritten or deleted.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#F26522] hover:bg-[#d9551a] rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
          {loading ? "Loading…" : "Load built-in jobs"}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <strong>{result.inserted.toLocaleString()}</strong> loaded ·{" "}
            <strong>{result.alreadyPresent.toLocaleString()}</strong> already present. Refresh the
            Dashboard to see them.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Upload / upsert ─────────────────────────────────────────────────────────

function UploadCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/jobs/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setSummary(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Upload RMS export</h2>
      <p className="text-xs text-gray-400 mb-4">
        Drop in the latest open-jobs export. Each upload is an{" "}
        <span className="font-semibold text-gray-600">upsert</span> keyed on job
        number — uploaded fields refresh, your manual commitments are preserved,
        and jobs that left the export are flagged closed (never deleted).
      </p>

      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
          isDragActive ? "border-[#F26522] bg-[#F26522]/5" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        {loading ? (
          <Loader2 className="h-9 w-9 animate-spin text-[#F26522]" />
        ) : (
          <>
            <FileSpreadsheet className="h-9 w-9 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-600">
              {isDragActive ? "Drop to upload" : "Drag & drop, or click to choose"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">.xlsx, .xls, or .csv</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              <strong>{summary.matched}</strong> updated · <strong>{summary.inserted}</strong> new ·{" "}
              <strong>{summary.closed}</strong> closed
              {summary.reopened > 0 ? ` · ${summary.reopened} reopened` : ""}
              {summary.skipped > 0 ? ` · ${summary.skipped} skipped` : ""} — all manual data preserved.
            </span>
          </div>

          <div className="rounded-lg border border-gray-100 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Detected columns
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              {Object.entries(summary.detectedColumns).map(([field, header]) => (
                <div key={field} className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">{field}</span>
                  <span className={header ? "text-gray-800 font-medium truncate" : "text-gray-300"}>
                    {header || "not found"}
                  </span>
                </div>
              ))}
            </div>
            {summary.unmatchedHeaders.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-2">
                Ignored columns: {summary.unmatchedHeaders.join(", ")}
              </p>
            )}
          </div>

          {(() => {
            const dc = summary.detectedColumns;
            const missing: string[] = [];
            if (!dc.pm) missing.push("PM");
            if (!dc.office) missing.push("Office");
            if (!dc.rmsUrl && !dc.externalId) missing.push("Job URL or Job ID");
            if (missing.length === 0) return null;
            const filters = !dc.pm || !dc.office;
            const links = !dc.rmsUrl && !dc.externalId;
            return (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] text-amber-700">
                <span className="font-semibold">Optional:</span> add {missing.join(", ")} to your RMS
                export to turn on
                {filters ? " PM/Office filters" : ""}
                {filters && links ? " and" : ""}
                {links ? " one-click RMS links" : ""}. Extra columns are harmless.
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Custom job-status list ──────────────────────────────────────────────────

function StatusListCard() {
  const [statuses, setStatuses] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    fetch("/api/jobs/statuses")
      .then((r) => r.json())
      .then((d) => {
        setStatuses(d.data?.statuses ?? []);
        setIsDefault(d.data?.isDefault ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const add = () => {
    const v = newValue.trim();
    if (!v || statuses.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    setStatuses([...statuses, v]);
    setNewValue("");
    setIsDefault(false);
  };

  const remove = (i: number) => {
    setStatuses(statuses.filter((_, idx) => idx !== i));
    setIsDefault(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/jobs/statuses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statuses }),
    });
    setSaving(false);
    setIsDefault(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Job statuses</h2>
      <p className="text-xs text-gray-400 mb-4">
        The allowed set of statuses. Drives the dashboard&apos;s &ldquo;# of jobs
        by status&rdquo; chart and the Open Jobs filter.
        {isDefault && " (Showing defaults — save to customize.)"}
      </p>

      {loading ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="space-y-1.5 mb-3">
            {statuses.map((s, i) => (
              <div
                key={`${s}-${i}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-1.5"
              >
                <span className="text-xs text-gray-700">{s}</span>
                <button
                  onClick={() => remove(i)}
                  className="text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {statuses.length === 0 && (
              <p className="text-[11px] text-gray-300">No statuses. Add one below.</p>
            )}
          </div>

          <div className="flex gap-1.5 mb-4">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add a status…"
              className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#F26522]"
            />
            <button onClick={add} className="text-[#F26522] hover:bg-[#F26522]/10 rounded-lg px-2">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#222] hover:bg-[#333] rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save status list"}
          </button>
        </>
      )}
    </div>
  );
}
