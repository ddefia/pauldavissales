"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  Users,
  Building2,
  Home,
  Brain,
  FileText,
  Search,
  Shield,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Pre-Call Reports", href: "/pre-call", icon: Zap },
  { name: "Lead Finder", href: "/lead-finder", icon: Search },
];

const toolsNav = [
  { name: "Enrichment", href: "/enrichment", icon: Brain },
  { name: "Imports", href: "/imports", icon: Upload },
  { name: "Organizations", href: "/organizations", icon: Building2 },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "PDFs", href: "/pdfs", icon: FileText },
  { name: "Admin", href: "/admin", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const toolsActive = toolsNav.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const [toolsOpen, setToolsOpen] = useState(toolsActive);

  return (
    <div className="flex h-full w-60 flex-col bg-[#1a1a1a]">
      {/* Brand */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[#C4A265] text-sm font-bold tracking-widest">PAUL DAVIS</span>
        </div>
        <p className="text-[9px] text-gray-500 tracking-[0.2em] mt-0.5 uppercase">Property Restoration</p>
      </div>

      {/* Territory pill */}
      <div className="mx-4 mb-4">
        <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase text-center">
            Palm Beach · Treasure Coast
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {mainNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-all rounded-lg",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              )}
            >
              <item.icon className={cn("h-[16px] w-[16px]", isActive ? "text-[#C4A265]" : "")} />
              {item.name}
            </Link>
          );
        })}

        <div className="pt-4">
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-400 transition-colors"
          >
            {toolsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Tools
          </button>
        </div>
        {toolsOpen &&
          toolsNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 pl-7 text-[12px] font-medium transition-all rounded-lg",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-[#C4A265]" : "")} />
                {item.name}
              </Link>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5">
        <p className="text-[10px] text-gray-600">Second Brain v1.0</p>
      </div>
    </div>
  );
}
