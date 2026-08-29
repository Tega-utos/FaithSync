'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { getAuthErrorMessage } from '@/lib/authErrors'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Listen for Supabase PASSWORD_RECOVERY event or active session
  useEffect(() => {
    const supabase = createClient()

    // 1. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN') || (session && event === 'INITIAL_SESSION')) {
        setReady(true)
        setChecking(false)
      }
    })

    // 2. Check active user / session
    const checkRecoverySession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setReady(true)
          setChecking(false)
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          setReady(true)
          setChecking(false)
          return
        }

        if (typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.search.includes('code='))) {
          setReady(true)
          setChecking(false)
          return
        }
      } catch {
        // Handled below
      }
    }

    checkRecoverySession()

    // 3. Grace period timeout
    const timer = setTimeout(() => {
      setChecking(false)
    }, 2500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateErr) throw updateErr

      // Sign out from recovery session so user can log in with new password
      await supabase.auth.signOut()
      setSuccess(true)
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
      setLoading(false)
    }
  }

  // State A: Checking Link Validity
  if (checking) {
    return (
      <AuthCard subtitle="Verifying Reset Link" closeHref="/login">
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
          <CircleNotch size={28} className="animate-spin text-[#FBBF24]" />
          <p className="text-xs font-bold text-[#707070]">Verifying recovery link...</p>
        </div>
      </AuthCard>
    )
  }

  // State B: Success State
  if (success) {
    return (
      <AuthCard subtitle="Password Updated" closeHref="/login">
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle size={32} weight="fill" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-[#0E0E0E]">Password Reset Complete</h3>
            <p className="text-xs text-[#707070] leading-relaxed max-w-xs mx-auto">
              Your password has been successfully updated. You can now sign in with your new credentials.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all text-center"
            >
              Sign In Now
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // State C: Invalid / Expired Link
  if (!ready) {
    return (
      <AuthCard subtitle="Link Expired" closeHref="/login">
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-sm">
            <WarningCircle size={32} weight="fill" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-[#0E0E0E]">Reset Link Expired</h3>
            <p className="text-xs text-[#707070] leading-relaxed max-w-xs mx-auto">
              This password recovery link is invalid or has expired. Please request a new link.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <Link
              href="/forgot-password"
              className="inline-block w-full py-3.5 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-xs shadow-sm hover:bg-[#f5b318] transition-all text-center"
            >
              Request New Link
            </Link>
            <Link
              href="/login"
              className="inline-block w-full py-3 px-6 text-center text-xs font-bold text-[#707070] hover:text-[#0E0E0E] transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // State D: Set New Password Form
  return (
    <AuthCard subtitle="Set New Password" closeHref="/login">
      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <WarningCircle size={16} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-[#707070] leading-relaxed">
        Choose a secure new password with at least 6 characters.
      </p>

      <form onSubmit={handleUpdatePassword} className="space-y-3.5">
        <AuthInput
          label="New Password"
          type="password"
          name="new-password"
          placeholder="At least 6 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          icon={<Lock size={16} />}
          autoComplete="new-password"
          required
        />

        <AuthInput
          label="Confirm New Password"
          type="password"
          name="confirm-password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock size={16} />}
          autoComplete="new-password"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
        >
          {loading ? (
            <>
              <CircleNotch size={18} className="animate-spin text-[#0E0E0E]" />
              <span>Updating Password...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>
    </AuthCard>
  )
}
