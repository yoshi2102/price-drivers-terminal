import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

/* Access, in order of preference:
   1. SSO (Auth.js) when AUTH_SECRET is set: Buoyant domain only.
   2. HTTP Basic password when PDT_ACCESS_PASSWORD is set: pilot fallback.
   3. Neither set: open on localhost, but on Vercel every request gets 503,
      so a deploy without access settings never serves licensed data. */
const sso = auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith("/signin")) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
});

function basic(req: NextRequest) {
  const want = process.env.PDT_ACCESS_PASSWORD!;
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    const [, pass] = atob(h.slice(6)).split(/:(.*)/s);
    if (pass && pass.length === want.length) {
      let diff = 0;
      for (let i = 0; i < want.length; i++) diff |= pass.charCodeAt(i) ^ want.charCodeAt(i);
      if (diff === 0) return NextResponse.next();
    }
  }
  return new NextResponse("Sign in required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Price Drivers Terminal", charset="UTF-8"' } });
}

export default function middleware(req: NextRequest, ev: any) {
  if (process.env.AUTH_SECRET) return (sso as any)(req, ev);
  if (process.env.PDT_ACCESS_PASSWORD) return basic(req);
  if (process.env.VERCEL) return new NextResponse("Access is not configured. Set PDT_ACCESS_PASSWORD or the SSO variables in Vercel, then redeploy.", { status: 503 });
  return NextResponse.next();
}

// Everything, including /data/* scenario caches, sits behind the gate.
export const config = { matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"] };
