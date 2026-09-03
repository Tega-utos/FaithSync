'use client'

import React from 'react'
import { CheckCircle, HandsPraying, BookOpen, Church, Bell, CircleNotch, CaretLeft } from '@phosphor-icons/react'

interface StepCompleteProps {
  church: string
  prayerTarget: number
  studyTarget: number
  allowNotifications: boolean
  saving: boolean
  onFinish: () => void
  onBack: () => void
}

export function StepComplete({
  church,
  prayerTarget,
  studyTarget,
  allowNotifications,
  saving,
  onFinish,
  onBack,
}: StepCompleteProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle size={36} weight="fill" />
        </div>
        <div>
          <h2 className="text-xl font-black text-text-primary tracking-tight">
            You&apos;re All Set!
          </h2>
          <p className="text-xs text-text-secondary max-w-xs mx-auto mt-0.5">
            Your personal devotion targets and routine are ready.
          </p>
        </div>
      </div>

      {/* Summary Recap Card */}
      <div className="p-4 rounded-3xl bg-surface border border-border divide-y divide-border text-xs font-bold text-text-primary shadow-2xs">
        <div className="pb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-text-secondary">
            <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" />
            Daily Prayer Goal
          </span>
          <span className="font-mono-tabular font-black">{prayerTarget} min</span>
        </div>

        <div className="py-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-text-secondary">
            <BookOpen size={16} weight="bold" className="text-emerald-700" />
            Daily Study Goal
          </span>
          <span className="font-mono-tabular font-black">{studyTarget} min</span>
        </div>

        <div className="py-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-text-secondary">
            <Church size={16} className="text-[#FBBF24]" />
            Local Assembly
          </span>
          <span className="truncate max-w-[150px] font-black">{church || 'Local Assembly'}</span>
        </div>

        <div className="pt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-text-secondary">
            <Bell size={16} className="text-[#FBBF24]" />
            Push Reminders
          </span>
          <span className="font-black text-emerald-600">
            {allowNotifications ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="py-4 px-5 rounded-2xl bg-card border border-border text-text-primary font-bold text-xs hover:bg-[#FDF9F1] dark:bg-amber-950/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <CaretLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          className="flex-1 py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <CircleNotch size={18} className="animate-spin text-text-primary" />
              <span>Saving Setup...</span>
            </>
          ) : (
            <span>Enter FaithSync</span>
          )}
        </button>
      </div>
    </div>
  )
}

export default StepComplete
