import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith('/search') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/gallery')
  const isLoginPage = pathname === '/login'

  if (isProtected && !sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isLoginPage && sessionCookie) {
    return NextResponse.redirect(new URL('/search', request.url))
  }
}
