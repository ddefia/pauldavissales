"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus } from "lucide-react";

interface ImportBatch {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  source: string;
  sourceLabel: string | null;
  totalRows: number | null;
  newContacts: number | null;
  newOrganizations: number | null;
  newProperties: number | null;
  duplicatesFound: number | null;
  errorRows: number | null;
  createdAt: string;
  completedAt: string | null;
  uploadedBy: { name: string; email: string };
}

const statusColors: Record<string, string> = {
  UPLOADED: "secondary",
  PARSING: "secondary",
  AWAITING_MAPPING: "outline",
  MAPPING_COMPLETE: "outline",
  PROCESSING: "secondary",
  DEDUPLICATING: "secondary",
  VALIDATING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
  CANCELLED: "destructive",
};

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/imports")
      .then((r) => r.json())
      .then((d) => { setImports(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Imports</h1>
          <p className="text-sm text-gray-500">Upload and manage contact data imports</p>
        </div>
        <Link href="/imports/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Import</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-12 animate-pulse rounded bg-gray-200" /></CardContent></Card>
          ))}
        </div>
      ) : imports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium">No imports yet</h3>
            <p className="text-sm text-gray-500 mb-4">Upload your first Excel or CSV file to get started</p>
            <Link href="/imports/new"><Button>Upload File</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => (
            <Link key={imp.id} href={`/imports/${imp.id}`}>
              <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium">{imp.fileName}</p>
                        <Badge variant={statusColors[imp.status] as any ?? "secondary"}>
                          {imp.status}
                        </Badge>
                        <Badge variant="outline">{imp.source.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span>{(imp.fileSize / 1024).toFixed(0)} KB</span>
                        {imp.totalRows && <span>{imp.totalRows} rows</span>}
                        {imp.newContacts !== null && <span>{imp.newContacts} contacts created</span>}
                        {imp.duplicatesFound !== null && imp.duplicatesFound > 0 && (
                          <span className="text-amber-600">{imp.duplicatesFound} duplicates</span>
                        )}
                        {imp.errorRows !== null && imp.errorRows > 0 && (
                          <span className="text-red-600">{imp.errorRows} errors</span>
                        )}
                        <span>by {imp.uploadedBy.name}</span>
                        <span>{new Date(imp.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
