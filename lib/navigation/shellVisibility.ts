/**
 * Single source of truth for App Shell visibility (Header and BottomNav).
 * Pre-auth pages (Splash, Welcome, Login, Register, Forgot/Reset Password)
 * and Onboarding setup must NEVER render the Header or BottomNav.
 */

export function shouldShowAppShell(pathname: string | null): boolean {
  if (!pathname) return false

  // Normalize path (strip trailing slash except root)
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname

  const preAuthRoutes = [
    '/',
    '/welcome',
    '/login',
    '/signup',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/onboarding',
  ]

  if (preAuthRoutes.includes(normalizedPath)) {
    return false
  }

  // Auth subpaths, callbacks, and session-summary screens
  if (
    normalizedPath.startsWith('/auth') ||
    normalizedPath.startsWith('/login') ||
    normalizedPath.startsWith('/signup') ||
    normalizedPath.startsWith('/register') ||
    normalizedPath.startsWith('/forgot-password') ||
    normalizedPath.startsWith('/reset-password') ||
    normalizedPath.startsWith('/session-summary')
  ) {
    return false
  }

  return true
}

export default shouldShowAppShell
