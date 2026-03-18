"use client";

import { User } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-12 items-center justify-end border-b border-gray-100 bg-white px-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-[#C4A265]" />
        </div>
        <span className="text-xs text-gray-500 font-medium">Admin</span>
      </div>
    </header>
  );
}
