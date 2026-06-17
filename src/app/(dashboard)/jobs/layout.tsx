"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ListChecks, CheckSquare, Settings } from "lucide-react";

const tabs = [
  { name: "Dashboard", href: "/jobs", icon: LayoutDashboard },
  { name: "Open Jobs", href: "/jobs/open", icon: ListChecks },
  { name: "Action Tasks", href: "/jobs/actions", icon: CheckSquare },
  { name: "Settings", href: "/jobs/settings", icon: Settings },
];

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs Review</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Open-job accountability · commitments on the record
          </p>
        </div>
      </div>

      {/* Sub-tabs — hidden in print so PDF exports stay clean */}
      <div className="flex items-center gap-1 border-b border-gray-200 print:hidden">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/jobs"
              ? pathname === "/jobs"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-[#C4A265] text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
