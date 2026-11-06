import { NextResponse, type NextRequest } from "next/server";

function parseEdgeSession(token: string): { staffId: number; name: string; role: string; exp: number } | null {
  try {
    const split = token.lastIndexOf(".");
    if (split <= 0) return null;
    const b64 = token.slice(0, split).replace(/-/g, "+").replace(/_/g, "/");
    // Standard base64 decoding in Edge & Node runtime
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const session = JSON.parse(jsonStr);
    if (!session.exp || session.exp < Date.now()) return null;
    if (!session.role || !session.staffId) return null;
    return session;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass static assets and internal Next.js requests
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Public routes: Home, Login, Display screen, Customer Receipt tracker, Public APIs
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/display" ||
    pathname.startsWith("/receipt") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public")
  ) {
    // If user is already logged in with valid session and visits /login, redirect to intended target
    if (pathname === "/login") {
      const cookie = req.cookies.get("tj_session")?.value;
      if (cookie) {
        const session = parseEdgeSession(cookie);
        if (session) {
          const next =
            req.nextUrl.searchParams.get("next") ||
            (session.role === "admin" ? "/v2/admin" : "/v2");
          return NextResponse.redirect(new URL(next, req.url));
        }
      }
    }
    return NextResponse.next();
  }

  // 3. Protected Routes
  const isV2Admin = pathname.startsWith("/v2/admin") || pathname.startsWith("/admin");
  const isProtectedArea =
    isV2Admin ||
    pathname.startsWith("/v2") ||
    pathname === "/cashier" ||
    pathname === "/desk" ||
    pathname === "/floor" ||
    pathname === "/kitchen";

  if (isProtectedArea) {
    const cookie = req.cookies.get("tj_session")?.value;
    if (!cookie) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = parseEdgeSession(cookie);
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("error", "Session expired. Please sign in with your PIN.");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("tj_session");
      return response;
    }

    // Role-based Access Control (RBAC):
    // Only 'admin' role can access admin hub
    if (isV2Admin && session.role !== "admin") {
      const fallbackUrl = new URL("/v2", req.url);
      fallbackUrl.searchParams.set("error", "Admin privileges required.");
      return NextResponse.redirect(fallbackUrl);
    }

    // Attach verified session headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-staff-id", String(session.staffId));
    requestHeaders.set("x-staff-role", session.role);
    requestHeaders.set("x-staff-name", encodeURIComponent(session.name));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
