"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

export function Header() {
  // Rendered client-side only to avoid a server/client date mismatch.
  const [today, setToday] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setToday(
        new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-100 bg-white px-6 print:hidden">
      <p className="text-xs text-gray-400">{today}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">
          Internal
        </span>
        <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-[#F26522]" />
        </div>
        <span className="text-xs text-gray-500 font-medium">Admin</span>
      </div>
    </header>
  );
}
