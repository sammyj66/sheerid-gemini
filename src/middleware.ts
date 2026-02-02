import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCookies } from "@/lib/admin/auth";
import { verifyAdminToken } from "@/lib/admin/token";

function getToken(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.admin_session || null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isLoginApi = pathname === "/api/admin/login";
  const isAdminPage = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  if (isLoginApi || isLoginPage) {
    return NextResponse.next();
  }

  const token = getToken(request);
  const payload = await verifyAdminToken(token);

  if (!payload) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
