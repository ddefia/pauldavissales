"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users, Building2, MapPin, Mail, Phone } from "lucide-react";

interface Contact {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  dataQualityScore: number | null;
  source: string;
  city: string | null;
  state: string | null;
  organization: { id: string; name: string; orgType: string | null } | null;
  territory: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  RAW: "secondary",
  VALIDATED: "default",
  ENRICHED: "default",
  SCORED: "default",
  ACTIVE: "default",
  CONTACTED: "outline",
  QUALIFIED: "default",
  DISQUALIFIED: "destructive",
  DO_NOT_CONTACT: "destructive",
};

const PAGE_SIZE_OPTIONS = ["25", "50", "100", "250", "500"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchContacts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter && statusFilter !== "__all__") params.set("status", statusFilter);

    fetch(`/api/contacts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.data || []);
        setTotalPages(d.pagination?.totalPages ?? 1);
        setTotal(d.pagination?.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  // Generate page numbers to show
  function getPageNumbers(): (number | "...")[] {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} contacts total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            <SelectItem value="RAW">Raw</SelectItem>
            <SelectItem value="VALIDATED">Validated</SelectItem>
            <SelectItem value="ENRICHED">Enriched</SelectItem>
            <SelectItem value="SCORED">Scored</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="CONTACTED">Contacted</SelectItem>
            <SelectItem value="QUALIFIED">Qualified</SelectItem>
            <SelectItem value="DISQUALIFIED">Disqualified</SelectItem>
            <SelectItem value="DO_NOT_CONTACT">Do Not Contact</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={size}>{size} per page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(10)].map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground/50" />
                        <p>No contacts found</p>
                        {debouncedSearch && (
                          <p className="text-xs">Try a different search term</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((c, idx) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {startRow + idx}
                      </TableCell>
                      <TableCell>
                        <Link href={`/contacts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                          {c.fullName || `${c.firstName} ${c.lastName}`.trim() || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {c.title ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{c.email}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.phone}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.organization ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[180px]">{c.organization.name}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.territory ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{c.territory.name}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[c.status] as any ?? "secondary"} className="text-xs">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.dataQualityScore !== null ? (
                          <span className={`text-sm font-semibold ${
                            c.dataQualityScore >= 70 ? "text-green-600" :
                            c.dataQualityScore >= 40 ? "text-amber-500" : "text-red-500"
                          }`}>
                            {c.dataQualityScore}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{startRow.toLocaleString()}</span> to{" "}
            <span className="font-medium">{endRow.toLocaleString()}</span> of{" "}
            <span className="font-medium">{total.toLocaleString()}</span> contacts
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
