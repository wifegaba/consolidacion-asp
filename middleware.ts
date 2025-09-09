// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ✅ No imports “pesados” (nada de supabase, jose, fetch, arrayBuffer, etc.)
// ✅ Solo lee una cookie pequeña

export function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Protege todo /panel
  if (pathname.startsWith("/panel")) {
    const isAdmin = req.cookies.get("admin")?.value === "1";
    if (!isAdmin) {
      const url = new URL("/login", origin);
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Solo corre en /panel
export const config = {
  matcher: ["/panel/:path*", "/panel"],
};
