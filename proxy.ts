import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, image files and the
     * crawler/metadata files (sitemap, robots, llms.txt, manifest, social
     * cards), so the session is refreshed on page navigations and API/auth
     * routes without a Supabase round trip on every bot fetch.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|llms.txt|manifest.webmanifest|(?:.*/)?opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
