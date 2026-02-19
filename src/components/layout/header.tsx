"use client";

import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Admin</span>
        <Badge variant="secondary" className="text-xs">
          ADMIN
        </Badge>
      </div>
    </header>
  );
}
