"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Users,
  Building2,
  Home,
  Upload,
  ClipboardList,
  Shield,
  FileText,
  Brain,
  BarChart3,
  Loader2,
  MapPin,
} from "lucide-react";

interface SystemStats {
  totalContacts: number;
  goldenRecords: number;
  enrichedContacts: number;
  scoredContacts: number;
  totalOrgs: number;
  totalProperties: number;
  totalImports: number;
  totalUsers: number;
  activeUsers: number;
  pendingDupes: number;
  totalValidations: number;
  totalTalkTracks: number;
  totalPdfs: number;
  contactsByStatus: { status: string; count: number }[];
  contactsBySource: { source: string; count: number }[];
}

interface TerritoryInfo {
  id: string;
  name: string;
  isActive: boolean;
  zipCodes: string[];
  counties: string[];
  _count: { contacts: number; properties: number };
}

export default function AdminPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [territories, setTerritories] = useState<TerritoryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.data?.stats || null);
        setTerritories(d.data?.territories || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">System overview and governance</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link href="/admin/users">
          <Card className="hover:border-gray-300 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-[#1a1a1a]" />
              <div>
                <p className="font-semibold">User Management</p>
                <p className="text-sm text-gray-500">{stats?.totalUsers || 0} users ({stats?.activeUsers || 0} active)</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/audit-log">
          <Card className="hover:border-gray-300 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-3 p-4">
              <ClipboardList className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-semibold">Audit Log</p>
                <p className="text-sm text-gray-500">Activity trail + compliance</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Shield className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold">System Health</p>
              <Badge className="bg-green-100 text-green-800">All Systems Go</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.goldenRecords}</p>
              <p className="text-xs text-gray-500">Golden Records</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Building2 className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalOrgs}</p>
              <p className="text-xs text-gray-500">Organizations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Home className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalProperties}</p>
              <p className="text-xs text-gray-500">Properties</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.enrichedContacts}</p>
              <p className="text-xs text-gray-500">Enriched</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.scoredContacts}</p>
              <p className="text-xs text-gray-500">Scored</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Upload className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalImports}</p>
              <p className="text-xs text-gray-500">Imports</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalValidations}</p>
              <p className="text-xs text-gray-500">Validations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalTalkTracks}</p>
              <p className="text-xs text-gray-500">Talk Tracks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalPdfs}</p>
              <p className="text-xs text-gray-500">PDFs Generated</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-gray-400 mb-1" />
              <p className="text-2xl font-bold">{stats.pendingDupes}</p>
              <p className="text-xs text-gray-500">Pending Dupes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contacts by Status */}
      {stats && stats.contactsByStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.contactsByStatus.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2"
                >
                  <Badge variant="outline">{s.status}</Badge>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts by Source */}
      {stats && stats.contactsBySource.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.contactsBySource.map((s) => (
                <div
                  key={s.source}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2"
                >
                  <Badge variant="outline">{s.source.replace("_", " ")}</Badge>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Territories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Territories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {territories.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {!t.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {t.counties.join(", ")} &middot; {t.zipCodes.length} ZIP codes
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-semibold">{t._count.contacts}</p>
                    <p className="text-xs text-gray-500">Contacts</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{t._count.properties}</p>
                    <p className="text-xs text-gray-500">Properties</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
