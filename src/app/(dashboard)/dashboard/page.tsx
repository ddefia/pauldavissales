"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Home, Upload, Mail, Phone, ShieldCheck, Copy } from "lucide-react";

interface DashboardStats {
  totalContacts: number;
  totalOrganizations: number;
  totalProperties: number;
  totalImports: number;
  emailCoverage: number;
  phoneCoverage: number;
  validatedPct: number;
  avgDataQuality: number;
  pendingDuplicates: number;
  recentImports: Array<{
    id: string;
    fileName: string;
    status: string;
    source: string;
    totalRows: number | null;
    newContacts: number | null;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { title: "Total Contacts", value: stats.totalContacts, icon: Users, color: "text-blue-600" },
    { title: "Organizations", value: stats.totalOrganizations, icon: Building2, color: "text-green-600" },
    { title: "Properties", value: stats.totalProperties, icon: Home, color: "text-purple-600" },
    { title: "Imports", value: stats.totalImports, icon: Upload, color: "text-orange-600" },
    { title: "Email Coverage", value: `${stats.emailCoverage}%`, icon: Mail, color: "text-cyan-600" },
    { title: "Phone Coverage", value: `${stats.phoneCoverage}%`, icon: Phone, color: "text-indigo-600" },
    { title: "Validated", value: `${stats.validatedPct}%`, icon: ShieldCheck, color: "text-emerald-600" },
    { title: "Pending Dupes", value: stats.pendingDuplicates, icon: Copy, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Data quality overview for your sales pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.avgDataQuality > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded-full bg-gray-200">
                <div
                  className="h-4 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${stats.avgDataQuality}%` }}
                />
              </div>
              <span className="text-lg font-bold">{stats.avgDataQuality}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentImports.length === 0 ? (
            <p className="text-sm text-gray-500">
              No imports yet. Upload your first Excel file to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentImports.map((imp) => (
                <div
                  key={imp.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{imp.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {imp.source} &middot; {imp.totalRows ?? "?"} rows
                      {imp.newContacts ? ` &middot; ${imp.newContacts} new contacts` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      imp.status === "COMPLETED"
                        ? "default"
                        : imp.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
