import { NextResponse } from "next/server";
import { auth } from "@/auth";

/* Every page needs a signed-in Buoyant user. Local development without
   AUTH_SECRET runs open so the worker output can be checked quickly. */
export default process.env.AUTH_SECRET
  ? auth((req) => {
      if (!req.auth && !req.nextUrl.pathname.startsWith("/signin")) {
        const url = new URL("/signin", req.nextUrl.origin);
        url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
    })
  : () => NextResponse.next();

export const config = { matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|data/).*)"] };
