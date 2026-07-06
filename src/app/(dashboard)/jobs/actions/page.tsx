"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, FileDown, ClipboardList } from "lucide-react";
import { fmtDate, statusBadgeClass } from "@/modules/jobs/format";

interface ActionItem {
  id: string;
  text: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}
interface JobGroup {
  id: string;
  jobNumber: string;
  customerName: string | null;
  pm: string | null;
  office: string | null;
  jobStatus: string | null;
  rmsUrl: string | null;
  actionItems: ActionItem[];
}

export default function ActionTasksPage() {
  const [groups, setGroups] = useState<JobGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pms, setPms] = useState<string[]>([]);
  const [pm, setPm] = useState("");
  const [status, setStatus] = useState("open");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (pm) params.set("pm", pm);
    if (status) params.set("status", status);
    setLoading(true);
    fetch(`/api/jobs/action-items?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setGroups(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pm, status]);

  useEffect(() => {
    fetch("/api/jobs/filters")
      .then((r) => r.json())
      .then((d) => setPms(d.data?.pms ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (item: ActionItem) => {
    await fetch(`/api/jobs/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: item.status === "done" ? "open" : "done" }),
    });
    load();
  };

  const exportPdf = () => {
    const html = buildPrintHtml(groups, pm || (pms.length > 0 ? "All PMs" : "All jobs"), status);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.addEventListener("load", () => w.print());
    // Fallback if 'load' already fired for an about:blank doc.
    setTimeout(() => w.print(), 400);
  };

  const totalItems = groups.reduce((s, g) => s + g.actionItems.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {pms.length > 0 && (
          <select
            value={pm}
            onChange={(e) => setPm(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
          >
            <option value="">All PMs</option>
            {pms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          {[
            { v: "open", l: "Open" },
            { v: "done", l: "Done" },
            { v: "", l: "All" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setStatus(o.v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                status === o.v ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <button
          onClick={exportPdf}
          disabled={totalItems === 0}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#222] hover:bg-[#333] rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          <FileDown className="h-3.5 w-3.5" /> Export PDF
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No action items for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{g.customerName || "—"}</p>
                    {g.jobStatus && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusBadgeClass(
                          g.jobStatus
                        )}`}
                      >
                        {g.jobStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    #{g.jobNumber}
                    {g.pm ? ` · ${g.pm}` : ""}
                    {g.office ? ` · ${g.office}` : ""}
                  </p>
                </div>
                {g.rmsUrl && (
                  <a
                    href={g.rmsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-[#F26522]"
                    title="Open in RMS"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {g.actionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-2.5">
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
                    <span
                      className={`text-sm flex-1 ${
                        item.status === "done" ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.text}
                    </span>
                    <span className="text-[10px] text-gray-300 shrink-0">{fmtDate(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Build a clean, self-contained printable document for the chosen PM.
function buildPrintHtml(groups: JobGroup[], pmLabel: string, status: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const statusLabel = status === "open" ? "Open items" : status === "done" ? "Completed items" : "All items";
  const totalItems = groups.reduce((s, g) => s + g.actionItems.length, 0);
  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const body = groups
    .map(
      (g) => `
      <div class="job">
        <div class="job-head">
          <span class="cust">${esc(g.customerName || "—")}</span>
          <span class="meta">#${esc(g.jobNumber)}${g.pm ? " · " + esc(g.pm) : ""}</span>
        </div>
        <ul>
          ${g.actionItems
            .map(
              (i) =>
                `<li class="${i.status === "done" ? "done" : ""}"><span class="box">${
                  i.status === "done" ? "&#10003;" : "&#9744;"
                }</span>${esc(i.text)}</li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Action Items — ${esc(pmLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; }
    .topbar { background: #111111; color: #fff; padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
    .brandwrap { display: flex; align-items: center; gap: 12px; }
    .pd { width: 38px; height: 38px; border-radius: 8px; background: #F26522; color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; letter-spacing: -1px; }
    .wordmark { font-weight: 700; font-size: 15px; letter-spacing: 2px; }
    .tag { font-size: 8px; letter-spacing: 4px; color: #9a9a9a; margin-top: 3px; }
    .doclabel { font-size: 11px; letter-spacing: 3px; color: #F26522; font-weight: 700; }
    .content { padding: 28px 40px 0; }
    h1 { font-size: 22px; margin: 0 0 2px; }
    .sub { color: #888; font-size: 12px; margin-bottom: 24px; }
    .job { margin: 0 0 16px; padding-left: 12px; border-left: 3px solid #F26522; page-break-inside: avoid; }
    .job-head { margin-bottom: 6px; }
    .cust { font-weight: 700; font-size: 14px; }
    .meta { color: #999; font-size: 11px; margin-left: 8px; font-weight: 500; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { font-size: 13px; padding: 3px 0; }
    li.done { color: #999; text-decoration: line-through; }
    .box { display: inline-block; width: 18px; color: #F26522; font-weight: 700; }
    .empty { color: #999; padding: 12px 0; }
    .footer { margin: 32px 40px 0; border-top: 1px solid #eee; padding: 10px 0 24px; color: #aaa; font-size: 10px; }
    @page { margin: 0; }
  </style></head>
  <body>
    <div class="topbar">
      <div class="brandwrap">
        <div class="pd">PD</div>
        <div>
          <div class="wordmark">PAUL DAVIS</div>
          <div class="tag">RESTORATION</div>
        </div>
      </div>
      <div class="doclabel">ACTION ITEMS</div>
    </div>
    <div class="content">
      <h1>${esc(pmLabel)}</h1>
      <div class="sub">${statusLabel} · ${totalItems} item${totalItems === 1 ? "" : "s"} · Generated ${date}</div>
      ${body || "<p class='empty'>No action items.</p>"}
    </div>
    <div class="footer">Internal accountability record · Paul Davis Restoration · Confidential</div>
  </body></html>`;
}
