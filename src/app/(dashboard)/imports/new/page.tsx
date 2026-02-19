"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, ArrowRight, Loader2, Check, AlertCircle } from "lucide-react";

interface ColumnMapping {
  fileColumn: string;
  schemaField: string | null;
  confidence: number;
  sampleValues: string[];
}

const SCHEMA_FIELD_OPTIONS = [
  { value: "__skip__", label: "-- Skip --" },
  { group: "Contact", fields: [
    { value: "firstName", label: "First Name" },
    { value: "lastName", label: "Last Name" },
    { value: "prefix", label: "Prefix" },
    { value: "suffix", label: "Suffix" },
    { value: "title", label: "Job Title" },
    { value: "department", label: "Department" },
    { value: "email", label: "Email" },
    { value: "emailSecondary", label: "Secondary Email" },
    { value: "phone", label: "Phone" },
    { value: "phoneSecondary", label: "Secondary Phone" },
    { value: "phoneMobile", label: "Mobile Phone" },
    { value: "fax", label: "Fax" },
  ]},
  { group: "Organization", fields: [
    { value: "organizationName", label: "Organization Name" },
    { value: "organizationType", label: "Organization Type" },
    { value: "organizationWebsite", label: "Website" },
    { value: "organizationPhone", label: "Org Phone" },
  ]},
  { group: "Property", fields: [
    { value: "propertyName", label: "Property Name" },
    { value: "propertyType", label: "Property Type" },
    { value: "unitCount", label: "Unit Count" },
    { value: "yearBuilt", label: "Year Built" },
    { value: "floors", label: "Floors" },
  ]},
  { group: "Address", fields: [
    { value: "addressLine1", label: "Address Line 1" },
    { value: "addressLine2", label: "Address Line 2" },
    { value: "city", label: "City" },
    { value: "state", label: "State" },
    { value: "zipCode", label: "ZIP Code" },
    { value: "county", label: "County" },
  ]},
];

type Step = "upload" | "mapping" | "processing" | "done";

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [source, setSource] = useState("ALN_DATA");
  const [sourceLabel, setSourceLabel] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mapping state
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  // Processing state
  const [processResult, setProcessResult] = useState<any>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      // Step 1: Upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source);
      if (sourceLabel) formData.append("sourceLabel", sourceLabel);

      const uploadRes = await fetch("/api/imports", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const { data: batch } = await uploadRes.json();
      setImportId(batch.id);

      // Step 2: Parse & get column suggestions
      const previewRes = await fetch(`/api/imports/${batch.id}/preview`, { method: "POST" });
      if (!previewRes.ok) {
        const err = await previewRes.json();
        throw new Error(err.error || "Parse failed");
      }
      const preview = await previewRes.json();
      setMappings(preview.suggestedMapping);
      setSampleRows(preview.sampleRows);
      setTotalRows(preview.totalRows);
      setStep("mapping");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [source, sourceLabel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  function updateMapping(index: number, schemaField: string) {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, schemaField: schemaField || null, confidence: schemaField ? 1.0 : 0 }
          : m
      )
    );
  }

  async function submitMapping() {
    if (!importId) return;
    setLoading(true);
    setError("");

    try {
      const mappingObj: Record<string, string> = {};
      for (const m of mappings) {
        if (m.schemaField) {
          mappingObj[m.fileColumn] = m.schemaField;
        }
      }

      // Check that at least one useful field is mapped
      const mappedFields = Object.values(mappingObj);
      const hasName = mappedFields.includes("firstName") || mappedFields.includes("lastName");
      const hasEmail = mappedFields.includes("email");
      const hasPhone = mappedFields.includes("phone");
      if (!hasName && !hasEmail && !hasPhone) {
        throw new Error("Please map at least one of: First Name, Last Name, Email, or Phone");
      }

      await fetch(`/api/imports/${importId}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping: mappingObj }),
      });

      setStep("processing");

      // Trigger processing
      const processRes = await fetch(`/api/imports/${importId}/process`, {
        method: "POST",
      });
      const result = await processRes.json();

      if (!processRes.ok) throw new Error(result.error || "Processing failed");

      setProcessResult(result.data);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
      setStep("mapping");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">New Import</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "processing", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-4 w-4 text-gray-300" />}
            <span className={step === s ? "font-bold text-blue-600" : "text-gray-400"}>
              {s === "upload" ? "1. Upload" : s === "mapping" ? "2. Map Columns" : s === "processing" ? "3. Processing" : "4. Complete"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALN_DATA">ALN Data</SelectItem>
                    <SelectItem value="LUXOR">Luxor</SelectItem>
                    <SelectItem value="MANUAL">Manual / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Label (optional)</Label>
                <Input
                  placeholder="e.g., ALN Q1 2025"
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                />
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              {loading ? (
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-sm font-medium">
                    {isDragActive ? "Drop file here" : "Drag & drop Excel or CSV file"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Supports .xlsx, .xls, .csv</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns ({totalRows} rows detected)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Match your file columns to the correct fields. Auto-detected mappings are shown — adjust as needed.
            </p>

            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={m.fileColumn} className="flex items-center gap-3 rounded border p-3">
                  <div className="w-48 flex-shrink-0">
                    <p className="text-sm font-medium">{m.fileColumn}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {m.sampleValues.join(", ") || "—"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1">
                    <Select
                      value={m.schemaField ?? "__skip__"}
                      onValueChange={(v) => updateMapping(i, v === "__skip__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Skip this column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">-- Skip --</SelectItem>
                        {SCHEMA_FIELD_OPTIONS.filter((g) => "group" in g).map((group: any) => (
                          group.fields.map((f: any) => (
                            <SelectItem key={f.value} value={f.value}>
                              {group.group}: {f.label}
                            </SelectItem>
                          ))
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {m.confidence >= 0.9 && m.schemaField && (
                    <Badge variant="default" className="flex-shrink-0">Auto</Badge>
                  )}
                  {m.confidence >= 0.5 && m.confidence < 0.9 && m.schemaField && (
                    <Badge variant="secondary" className="flex-shrink-0">Suggested</Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setMappings([]); }}>
                Back
              </Button>
              <Button onClick={submitMapping} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Process Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-medium">Processing Import</h3>
            <p className="text-sm text-gray-500">
              Normalizing, deduplicating, and creating records...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === "done" && processResult && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center mb-6">
              <Check className="h-12 w-12 text-green-600 mb-3" />
              <h3 className="text-lg font-medium">Import Complete</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
              <div className="text-right text-gray-500">Status:</div>
              <div><Badge>{processResult.status}</Badge></div>
              <div className="text-right text-gray-500">Total Rows:</div>
              <div>{processResult.totalRows ?? "—"}</div>
              <div className="text-right text-gray-500">Contacts Created:</div>
              <div className="font-bold text-green-600">{processResult.newContacts ?? 0}</div>
              <div className="text-right text-gray-500">Organizations:</div>
              <div>{processResult.newOrganizations ?? 0}</div>
              <div className="text-right text-gray-500">Properties:</div>
              <div>{processResult.newProperties ?? 0}</div>
              <div className="text-right text-gray-500">Duplicates Found:</div>
              <div className={processResult.duplicatesFound > 0 ? "text-amber-600 font-bold" : ""}>
                {processResult.duplicatesFound ?? 0}
              </div>
              <div className="text-right text-gray-500">Errors:</div>
              <div className={processResult.errorRows > 0 ? "text-red-600" : ""}>
                {processResult.errorRows ?? 0}
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => router.push("/imports")}>
                All Imports
              </Button>
              <Button onClick={() => router.push("/contacts")}>
                View Contacts
              </Button>
              {processResult.duplicatesFound > 0 && (
                <Button variant="outline" onClick={() => router.push("/duplicates")}>
                  Review Duplicates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
