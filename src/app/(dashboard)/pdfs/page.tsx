"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ExternalLink, Printer } from "lucide-react";

interface GeneratedPdf {
  id: string;
  propertyId: string;
  filePath: string;
  createdAt: string;
  metadata: any;
  property: { name: string; city: string; state: string };
}

export default function PdfsPage() {
  const [pdfs, setPdfs] = useState<GeneratedPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [contactId, setContactId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/pdf-generator")
      .then((r) => r.json())
      .then((d) => {
        setPdfs(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function generatePdf() {
    if (!contactId.trim() || !propertyId.trim()) return;
    setGenerating(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/pdf-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contactId.trim(), propertyId: propertyId.trim() }),
      });
      const d = await res.json();
      if (d.error) {
        setLastResult({ error: d.error });
      } else {
        setLastResult({ success: true, id: d.data.id });
        // Refresh list
        const listRes = await fetch("/api/pdf-generator");
        const listData = await listRes.json();
        setPdfs(listData.data || []);
      }
    } catch (err) {
      setLastResult({ error: "Failed to generate PDF" });
    }
    setGenerating(false);
  }

  function openPdf(id: string) {
    window.open(`/api/pdf-generator/${id}?format=html`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PDF Generator</h1>
        <p className="text-sm text-gray-500">
          Generate prospect-specific leave-behind documents for sales visits
        </p>
      </div>

      {/* Generate Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate New PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Contact ID
              </label>
              <input
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="Paste contact ID"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Property ID
              </label>
              <input
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="Paste property ID"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={generatePdf} disabled={generating || !contactId || !propertyId}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Tip: Copy contact and property IDs from the Contacts or Properties page.
          </p>

          {lastResult && (
            <div className={`mt-3 p-3 rounded text-sm ${lastResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {lastResult.error ? lastResult.error : "PDF generated successfully!"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated PDFs List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Generated Documents</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-12 animate-pulse rounded bg-gray-200" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pdfs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium">No PDFs generated yet</h3>
              <p className="text-sm text-gray-500">
                Enter a contact and property ID above to create your first leave-behind.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pdfs.map((pdf) => (
              <Card key={pdf.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">
                        {pdf.property.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pdf.property.city}, {pdf.property.state}
                        {pdf.metadata?.contactName && ` — for ${pdf.metadata.contactName}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(pdf.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPdf(pdf.id)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const w = window.open(`/api/pdf-generator/${pdf.id}?format=html`, "_blank");
                        w?.addEventListener("load", () => w.print());
                      }}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Print
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
