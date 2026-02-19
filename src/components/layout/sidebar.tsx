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
  Copy,
  ShieldCheck,
  Brain,
  FileText,
  Search,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Enrichment", href: "/enrichment", icon: Brain },
  { name: "Lead Finder", href: "/lead-finder", icon: Search },
];

const toolsNav = [
  { name: "Imports", href: "/imports", icon: Upload },
  { name: "Duplicates", href: "/duplicates", icon: Copy },
  { name: "Validation", href: "/validation", icon: ShieldCheck },
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
    <div className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold text-blue-600">Paul Davis Sales</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {mainNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {/* Tools section - collapsible */}
        <button
          onClick={() => setToolsOpen(!toolsOpen)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 mt-4"
        >
          {toolsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Tools
        </button>
        {toolsOpen &&
          toolsNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 pl-6 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
