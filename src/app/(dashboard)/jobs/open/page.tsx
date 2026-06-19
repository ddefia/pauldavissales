"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
  Search,
  Lock,
  Check,
  Trash2,
  MoreVertical,
  X,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  fmtCurrency,
  fmtPct,
  fmtDate,
  toDateInput,
  upcomingMonths,
} from "@/modules/jobs/format";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  text: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
}
interface BillingForecast {
  id: string;
  month: string;
  amount: number;
}
interface Job {
  id: string;
  jobNumber: string;
  customerName: string | null;
  office: string | null;
  pm: string | null;
  jobStatus: string | null;
  currentEstimate: number | null;
  committedEstimate: number | null;
  actualGp: number | null;
  actualGpPct: number | null;
  rmsUrl: string | null;
  externalId: string | null;
  targetMargin: number | null;
  targetMarginUnit: string | null;
  targetCompletionDate: string | null;
  struckOut: boolean;
  closedFromExport: boolean;
  variance: number | null;
  variancePct: number | null;
  latestActionItem: ActionItem | null;
  openActionCount: number;
  isOpen: boolean;
  actionItems: ActionItem[];
  billingForecasts: BillingForecast[];
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OpenJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<{ pms: string[]; offices: string[]; statuses: string[] }>({
    pms: [],
    offices: [],
    statuses: [],
  });

  const [pm, setPm] = useState("");
  const [office, setOffice] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("open");
  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    const params = new URLSearchParams();
    if (pm) params.set("pm", pm);
    if (office) params.set("office", office);
    if (status) params.set("status", status);
    if (view) params.set("view", view);
    if (search) params.set("search", search);
    setLoading(true);
    fetch(`/api/jobs?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setJobs(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pm, office, status, view, search]);

  useEffect(() => {
    fetch("/api/jobs/filters")
      .then((r) => r.json())
      .then((d) => setOptions(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadJobs, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadJobs, search]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {options.pms.length > 0 && (
          <FilterSelect label="PM" value={pm} onChange={setPm} options={options.pms} />
        )}
        {options.offices.length > 0 && (
          <FilterSelect label="Office" value={office} onChange={setOffice} options={options.offices} />
        )}
        <FilterSelect label="Status" value={status} onChange={setStatus} options={options.statuses} />
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {["open", "closed", "all"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, job #, PM"
            className="w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#F26522]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1.3fr_0.9fr_1fr_1.4fr_auto] gap-3 px-5 py-2.5 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <div>Customer</div>
          <div>Status</div>
          <div>Estimate (committed → current)</div>
          <div>Margin (actual · target)</div>
          <div>Target date</div>
          <div>Action item</div>
          <div className="w-8" />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No jobs match these filters.
          </div>
        ) : (
          jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              expanded={expanded === job.id}
              onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
              adding={addingFor === job.id}
              onAddToggle={() => setAddingFor(addingFor === job.id ? null : job.id)}
              onChanged={loadJobs}
            />
          ))
        )}
      </div>

      <p className="text-[11px] text-gray-400 px-1">
        {jobs.length} job{jobs.length === 1 ? "" : "s"} ·{" "}
        <Lock className="inline h-3 w-3 -mt-0.5" /> locked fields are manual commitments preserved across uploads.
      </p>
    </div>
  );
}

// ─── Filter select ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F26522]"
    >
      <option value="">All {label}s</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────────

function JobRow({
  job,
  expanded,
  onToggle,
  adding,
  onAddToggle,
  onChanged,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
  adding: boolean;
  onAddToggle: () => void;
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [newAction, setNewAction] = useState("");

  const addAction = async () => {
    const text = newAction.trim();
    if (!text) return;
    await fetch(`/api/jobs/${job.id}/action-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setNewAction("");
    onAddToggle();
    onChanged();
  };

  const toggleStrike = async () => {
    setMenuOpen(false);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: job.struckOut ? JSON.stringify({ reopen: true }) : JSON.stringify({ struckOut: true }),
    });
    onChanged();
  };

  const varianceColor =
    job.variance == null
      ? "text-gray-400"
      : job.variance < 0
      ? "text-red-600"
      : job.variance > 0
      ? "text-emerald-600"
      : "text-gray-500";

  return (
    <div className={`border-b border-gray-50 last:border-0 ${job.struckOut || job.closedFromExport ? "bg-gray-50/60" : ""}`}>
      <div className="grid grid-cols-[1.6fr_1fr_1.3fr_0.9fr_1fr_1.4fr_auto] gap-3 px-5 py-3 items-center hover:bg-gray-50/60 transition-colors">
        {/* Customer + job number */}
        <button onClick={onToggle} className="flex items-start gap-2 text-left min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${job.struckOut || job.closedFromExport ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {job.customerName || "—"}
            </p>
            <span className="text-[11px] text-gray-400">#{job.jobNumber}</span>
            {job.closedFromExport && (
              <span className="ml-1.5 text-[9px] font-semibold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Closed · off export
              </span>
            )}
          </div>
        </button>

        {/* Status */}
        <div className="min-w-0">
          {job.jobStatus ? (
            <span className="inline-block text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded truncate max-w-full">
              {job.jobStatus}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>

        {/* Estimate */}
        <div className="text-xs tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400" title="Committed (locked snapshot)">
              {fmtCurrency(job.committedEstimate, true)}
            </span>
            <span className="text-gray-300">→</span>
            <span className="font-semibold text-gray-800">{fmtCurrency(job.currentEstimate, true)}</span>
          </div>
          {job.variance != null && job.variance !== 0 && (
            <span className={`text-[11px] ${varianceColor}`}>
              {fmtCurrency(job.variance, true)} ({fmtPct(job.variancePct)})
            </span>
          )}
        </div>

        {/* Margin — actual GP from export, with manual target beneath */}
        <div className="text-xs tabular-nums">
          {job.actualGpPct != null && (
            <div className="font-semibold text-gray-800" title="Actual gross-profit margin (from export)">
              {job.actualGpPct.toFixed(1)}%
              <span className="font-normal text-gray-400"> GP</span>
            </div>
          )}
          {job.targetMargin != null ? (
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Lock className="h-2.5 w-2.5 text-gray-300" />
              target{" "}
              {job.targetMarginUnit === "currency"
                ? fmtCurrency(job.targetMargin, true)
                : `${job.targetMargin}%`}
            </div>
          ) : (
            job.actualGpPct == null && <span className="text-gray-300">—</span>
          )}
        </div>

        {/* Target date */}
        <div className="text-xs text-gray-700">
          {job.targetCompletionDate ? (
            <span className="flex items-center gap-1">
              <Lock className="h-2.5 w-2.5 text-gray-300" />
              {fmtDate(job.targetCompletionDate)}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        {/* Action item + add */}
        <div className="min-w-0">
          {adding ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAction()}
                placeholder="New action item…"
                className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#F26522]"
              />
              <button onClick={addAction} className="text-emerald-600 hover:bg-emerald-50 rounded p-1">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={onAddToggle} className="text-gray-400 hover:bg-gray-100 rounded p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-gray-500 truncate flex-1" title={job.latestActionItem?.text}>
                {job.latestActionItem?.text || <span className="text-gray-300">No action items</span>}
              </span>
              {job.openActionCount > 1 && (
                <span className="text-[10px] text-gray-400 shrink-0">+{job.openActionCount - 1}</span>
              )}
              <button
                onClick={onAddToggle}
                title="Add action item"
                className="shrink-0 text-[#F26522] hover:bg-[#F26522]/10 rounded p-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Row menu */}
        <div className="relative w-8 flex justify-end">
          {job.rmsUrl ? (
            <a
              href={job.rmsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in RMS"
              className="text-gray-300 hover:text-[#F26522] p-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-gray-300 hover:text-gray-600 p-1"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-gray-100 bg-white shadow-lg py-1">
                <button
                  onClick={toggleStrike}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  {job.struckOut ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen job
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Strike out / close
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {expanded && <JobDetail job={job} onChanged={onChanged} />}
    </div>
  );
}

// ─── Expanded detail ─────────────────────────────────────────────────────────

function JobDetail({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const [margin, setMargin] = useState(job.targetMargin?.toString() ?? "");
  const [marginUnit, setMarginUnit] = useState(job.targetMarginUnit ?? "percent");
  const [targetDate, setTargetDate] = useState(toDateInput(job.targetCompletionDate));
  const [committed, setCommitted] = useState(job.committedEstimate?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#F26522]";

  const saveCommitments = async () => {
    setSaving(true);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMargin: margin === "" ? null : Number(margin),
        targetMarginUnit: marginUnit,
        targetCompletionDate: targetDate || null,
        committedEstimate: committed === "" ? null : Number(committed),
      }),
    });
    setSaving(false);
    onChanged();
  };

  return (
    <div className="bg-gray-50/70 border-t border-gray-100 px-5 py-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Commitments */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-[#F26522]" /> Accountability commitments
        </h3>
        <Field label="Committed estimate (baseline)">
          <input
            type="number"
            value={committed}
            onChange={(e) => setCommitted(e.target.value)}
            placeholder="auto-snapshot"
            className={inputCls}
          />
        </Field>
        {job.actualGp != null && (
          <div className="rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Actual GP (from export)
            </p>
            <p className="text-xs font-semibold text-gray-800 tabular-nums">
              {fmtCurrency(job.actualGp)}
              {job.actualGpPct != null && (
                <span className="font-normal text-gray-500"> · {job.actualGpPct.toFixed(1)}% margin</span>
              )}
            </p>
          </div>
        )}
        <Field label="Target margin">
          <div className="flex gap-1">
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className={`${inputCls} flex-1`}
            />
            <select
              value={marginUnit}
              onChange={(e) => setMarginUnit(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 text-xs"
            >
              <option value="percent">%</option>
              <option value="currency">$</option>
            </select>
          </div>
        </Field>
        <Field label="Target completion date">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <button
          onClick={saveCommitments}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#222] hover:bg-[#333] rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save commitments"}
        </button>
        <p className="text-[10px] text-gray-400">Edits are logged (old → new), never silently overwritten.</p>
      </div>

      {/* Billing forecast */}
      <BillingEditor job={job} onChanged={onChanged} />

      {/* Action items */}
      <ActionItemsEditor job={job} onChanged={onChanged} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Billing editor (3-month forecast) ───────────────────────────────────────

function BillingEditor({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const monthOpts = upcomingMonths(12);
  const initial = [0, 1, 2].map((i) => ({
    month: job.billingForecasts[i]?.month ?? "",
    amount: job.billingForecasts[i]?.amount?.toString() ?? "",
  }));
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = (i: number, key: "month" | "amount", val: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  const save = async () => {
    setSaving(true);
    const entries = rows
      .filter((r) => r.month && r.amount && Number(r.amount) > 0)
      .map((r) => ({ month: r.month, amount: Number(r.amount) }));
    await fetch(`/api/jobs/${job.id}/billing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setSaving(false);
    onChanged();
  };

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-700">3-month billing forecast</h3>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5">
          <select
            value={r.month}
            onChange={(e) => update(i, "month", e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs flex-1"
          >
            <option value="">Month…</option>
            {monthOpts.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={r.amount}
            onChange={(e) => update(i, "amount", e.target.value)}
            placeholder="$ amount"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs w-28"
          />
        </div>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400 tabular-nums">Total {fmtCurrency(total)}</span>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#222] hover:bg-[#333] rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save forecast"}
        </button>
      </div>
      <p className="text-[10px] text-gray-400">Rolls up into the dashboard cash-flow forecast.</p>
    </div>
  );
}

// ─── Action items editor ─────────────────────────────────────────────────────

function ActionItemsEditor({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const [text, setText] = useState("");

  const add = async () => {
    if (!text.trim()) return;
    await fetch(`/api/jobs/${job.id}/action-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    setText("");
    onChanged();
  };

  const toggle = async (item: ActionItem) => {
    await fetch(`/api/jobs/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status === "done" ? "open" : "done" }),
    });
    onChanged();
  };

  const remove = async (item: ActionItem) => {
    await fetch(`/api/jobs/action-items/${item.id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-700">Action items</h3>
      <div className="space-y-1.5 max-h-44 overflow-y-auto">
        {job.actionItems.length === 0 && (
          <p className="text-[11px] text-gray-300">None yet.</p>
        )}
        {job.actionItems.map((item) => (
          <div key={item.id} className="flex items-start gap-2 group">
            <button
              onClick={() => toggle(item)}
              className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                item.status === "done"
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-300 hover:border-[#F26522]"
              }`}
            >
              {item.status === "done" && <Check className="h-3 w-3 text-white" />}
            </button>
            <span className={`text-xs flex-1 ${item.status === "done" ? "text-gray-400 line-through" : "text-gray-700"}`}>
              {item.text}
            </span>
            <button
              onClick={() => remove(item)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an action item…"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#F26522]"
        />
        <button onClick={add} className="text-[#F26522] hover:bg-[#F26522]/10 rounded-lg px-2">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
