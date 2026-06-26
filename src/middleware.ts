import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The app is currently scoped to the Jobs Dashboard. The pre-existing lead-gen
// pages (which don't use the RMS Excel) are hidden: any direct visit to one of
// these routes redirects to /jobs. Nothing is deleted — remove a prefix from
// this list to bring a page back.
const HIDDEN_PREFIXES = [
  "/dashboard",
  "/contacts",
  "/properties",
  "/map",
  "/pre-call",
  "/lead-finder",
  "/enrichment",
  "/imports",
  "/organizations",
  "/pdfs",
  "/admin",
  "/validation",
  "/duplicates",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/jobs";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
