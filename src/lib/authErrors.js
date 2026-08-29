/**
 * Friendly Supabase Authentication Error Mapping
 */

export function getAuthErrorMessage(error) {
  const message = error?.message || error?.error_description || (typeof error === 'string' ? error : '')

  if (!message) return 'Something went wrong. Please try again.'
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (message.includes('Email not confirmed')) return 'Please verify your email before signing in.'
  if (message.includes('User already registered') || message.includes('already exists'))
    return 'An account with this email already exists.'
  if (message.includes('rate limit') || message.includes('Too many requests'))
    return 'Too many attempts. Please wait a moment and try again.'
  if (message.includes('Password should be') || message.includes('least 6 characters'))
    return 'Password must be at least 6 characters.'
  if (message.includes('Invalid Refresh Token') || message.includes('session expired'))
    return 'Your session has expired. Please sign in again.'
  if (message.includes('Auth session missing') || message.includes('recovery'))
    return 'This reset link is invalid or has expired.'

  return message.length < 100 ? message : 'Something went wrong. Please try again.'
}

export default getAuthErrorMessage
