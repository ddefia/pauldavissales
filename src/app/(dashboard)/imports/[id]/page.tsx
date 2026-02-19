"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ImportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/imports/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setBatch(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="animate-pulse h-64 bg-gray-200 rounded" />;
  if (!batch) return <p>Import not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/imports")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold">{batch.fileName}</h1>
        <Badge>{batch.status}</Badge>
        <Badge variant="outline">{batch.source.replace("_", " ")}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Rows", value: batch.totalRows ?? "—" },
          { label: "Processed", value: batch.processedRows ?? "—" },
          { label: "Contacts", value: batch._count?.contacts ?? batch.newContacts ?? "—" },
          { label: "Organizations", value: batch._count?.organizations ?? batch.newOrganizations ?? "—" },
          { label: "Properties", value: batch._count?.properties ?? batch.newProperties ?? "—" },
          { label: "Duplicates", value: batch.duplicatesFound ?? "—" },
          { label: "Skipped", value: batch.skippedRows ?? "—" },
          { label: "Errors", value: batch._count?.importErrors ?? batch.errorRows ?? "—" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-8">
            <span className="text-gray-500 w-32">File Size</span>
            <span>{(batch.fileSize / 1024).toFixed(0)} KB</span>
          </div>
          <div className="flex gap-8">
            <span className="text-gray-500 w-32">Uploaded By</span>
            <span>{batch.uploadedBy?.name ?? "Unknown"}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-gray-500 w-32">Uploaded At</span>
            <span>{new Date(batch.createdAt).toLocaleString()}</span>
          </div>
          {batch.completedAt && (
            <div className="flex gap-8">
              <span className="text-gray-500 w-32">Completed At</span>
              <span>{new Date(batch.completedAt).toLocaleString()}</span>
            </div>
          )}
          {batch.sourceLabel && (
            <div className="flex gap-8">
              <span className="text-gray-500 w-32">Source Label</span>
              <span>{batch.sourceLabel}</span>
            </div>
          )}
          {batch.errorMessage && (
            <div className="flex gap-8">
              <span className="text-gray-500 w-32">Error</span>
              <span className="text-red-600">{batch.errorMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
