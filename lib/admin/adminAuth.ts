import { SupabaseClient, User } from '@supabase/supabase-js'

export const SUPER_ADMIN_EMAILS = [
  'teeutos@gmail.com',
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()) : []),
]

/**
 * Checks if a given email belongs to a designated Super Admin.
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Verifies that the currently authenticated user in a Supabase client is a Super Admin.
 */
export async function verifySuperAdmin(
  supabase: SupabaseClient
): Promise<{ user: User | null; isAuthorized: boolean }> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user || !user.email) {
      return { user: null, isAuthorized: false }
    }

    const isAuthorized = isSuperAdmin(user.email)
    return { user, isAuthorized }
  } catch {
    return { user: null, isAuthorized: false }
  }
}
