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
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Brand Header — dark with gold logo */}
      <div className="bg-[#1a1a1a] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[#C4A265] text-[15px] font-extrabold tracking-wide">PAUL</span>
          <span className="text-[#C4A265] text-[15px] font-extrabold tracking-wide">DAVIS</span>
        </div>
        <p className="text-[10px] text-gray-400 tracking-[0.15em] mt-0.5">PROPERTY RESTORATION EXPERTS</p>
      </div>

      {/* Territory bar */}
      <div className="px-5 py-2 bg-[#ED1C24]">
        <p className="text-[10px] text-white font-semibold tracking-wider uppercase">Palm Beach County &bull; Treasure Coast</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto">
        {mainNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors rounded",
                isActive
                  ? "bg-gray-100 text-[#1a1a1a] border-l-2 border-[#ED1C24]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-[#ED1C24]" : "")} />
              {item.name}
            </Link>
          );
        })}

        <div className="pt-3">
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            {toolsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Tools
          </button>
        </div>
        {toolsOpen &&
          toolsNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 pl-7 text-[13px] font-medium transition-colors rounded",
                  isActive
                    ? "bg-gray-100 text-[#1a1a1a]"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-[#C4A265]" : "")} />
                {item.name}
              </Link>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-5 py-2.5 bg-gray-50">
        <p className="text-[10px] text-gray-400 font-medium">Sales Intelligence Platform</p>
      </div>
    </div>
  );
}
