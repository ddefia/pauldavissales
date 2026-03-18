"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (search) params.set("search", search);

    fetch(`/api/organizations?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setOrgs(d.data || []);
        setTotalPages(d.pagination?.totalPages ?? 1);
        setTotal(d.pagination?.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-gray-500">{total} organizations</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" placeholder="Search organizations..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Properties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>{[...Array(6)].map((__, j) => (
                    <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                  ))}</TableRow>
                ))
              ) : orgs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No organizations found</TableCell></TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/organizations/${org.id}`} className="font-medium text-[#1a1a1a] hover:text-[#C4A265]">
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {org.orgType ? <Badge variant="outline" className="text-xs">{org.orgType.replace("_", " ")}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{org.domain ?? "—"}</TableCell>
                    <TableCell className="text-sm">{org.phone ?? "—"}</TableCell>
                    <TableCell>{org._count?.contacts ?? 0}</TableCell>
                    <TableCell>{org._count?.managedProperties ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
