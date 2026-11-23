import { auth } from "@/lib/auth/server";

// Everything needs a signed-in user except the pages listed here.
// "/join" covers /join/KH-XXXX so an invite link can show the community before sign-in.
// "/api/session" is the small route that renews the session cookie for those public pages.
export default auth.middleware({
  loginUrl: "/",
  publicRoutes: ["/", "/offline", "/join", "/api/session"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)"],
};
