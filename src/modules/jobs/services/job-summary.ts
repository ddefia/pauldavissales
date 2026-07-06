/**
 * Generates a short, plain-English accountability summary of a single job using
 * Claude, grounded strictly in the job's own data. Cached on the Job row so it
 * survives uploads and isn't regenerated on every view.
 */

import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

function money(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export async function generateJobSummary(jobId: string): Promise<string> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { actionItems: true, billingForecasts: true },
  });

  const variance =
    job.currentEstimate != null && job.committedEstimate != null
      ? job.currentEstimate - job.committedEstimate
      : null;
  const gpPct =
    job.actualGp != null && job.currentEstimate
      ? `${((job.actualGp / job.currentEstimate) * 100).toFixed(1)}%`
      : "n/a";
  const targetMargin =
    job.targetMargin != null
      ? job.targetMarginUnit === "currency"
        ? money(job.targetMargin)
        : `${job.targetMargin}%`
      : "not set";
  const overdue =
    job.targetCompletionDate && job.targetCompletionDate < new Date()
      ? " (PAST target date)"
      : "";
  const openActions = job.actionItems
    .filter((a) => a.status === "open")
    .map((a) => a.text);
  const billing =
    job.billingForecasts.map((b) => `${b.month}: ${money(b.amount)}`).join(", ") ||
    "none";

  const facts = [
    `Customer: ${job.customerName ?? "n/a"}`,
    `Job #: ${job.jobNumber}`,
    `Status: ${job.jobStatus ?? "n/a"}`,
    `Committed estimate (baseline): ${money(job.committedEstimate)}`,
    `Current estimate: ${money(job.currentEstimate)}`,
    `Estimate variance: ${variance == null ? "n/a" : money(variance)}`,
    `Actual gross-profit margin: ${gpPct}`,
    `Target margin: ${targetMargin}`,
    `Target completion date: ${
      job.targetCompletionDate
        ? job.targetCompletionDate.toISOString().slice(0, 10) + overdue
        : "not set"
    }`,
    `Billing forecast: ${billing}`,
    `Open action items: ${openActions.length ? openActions.join("; ") : "none"}`,
  ].join("\n");

  const prompt = `You are summarizing a restoration job for a weekly accountability review at Paul Davis Restoration. Using ONLY the facts below, write 1-2 short sentences (max ~45 words) a manager can read at a glance. Lead with what matters for accountability: estimate drift vs. the committed baseline, margin health, whether it is past its target date, and the most pressing open action. Do NOT invent any facts or numbers not given. Plain text only, no preamble.

FACTS:
${facts}`;

  const res = await client().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const block = res.content.find((b) => b.type === "text");
  const summary = block && block.type === "text" ? block.text.trim() : "";
  if (!summary) throw new Error("No summary returned from Claude.");

  await prisma.job.update({
    where: { id: jobId },
    data: { aiSummary: summary, aiSummaryAt: new Date() },
  });

  return summary;
}
