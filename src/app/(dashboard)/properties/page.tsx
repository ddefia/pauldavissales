"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (search) params.set("search", search);

    fetch(`/api/properties?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setProperties(d.data || []);
        setTotalPages(d.pagination?.totalPages ?? 1);
        setTotal(d.pagination?.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Properties</h1>
        <p className="text-sm text-gray-500">{total} properties</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" placeholder="Search properties..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>ZIP</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Contacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>{[...Array(8)].map((__, j) => (
                    <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></TableCell>
                  ))}</TableRow>
                ))
              ) : properties.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No properties found</TableCell></TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/properties/${p.id}`} className="font-medium text-[#1a1a1a] hover:text-[#C4A265]">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.propertyType ? <Badge variant="outline" className="text-xs">{p.propertyType.replace("_", " ")}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{p.addressLine1 ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.city}</TableCell>
                    <TableCell className="text-sm">{p.zipCode}</TableCell>
                    <TableCell>{p.unitCount ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.territory?.name ?? "—"}</TableCell>
                    <TableCell>{p._count?.contacts ?? 0}</TableCell>
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
