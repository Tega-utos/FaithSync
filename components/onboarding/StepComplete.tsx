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
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle size={36} weight="fill" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">
            You&apos;re All Set!
          </h2>
          <p className="text-xs text-[#707070] max-w-xs mx-auto mt-0.5">
            Your personal devotion targets and routine are ready.
          </p>
        </div>
      </div>

      {/* Summary Recap Card */}
      <div className="p-4 rounded-3xl bg-[#FAF6EE] border border-[#E5E7EB] divide-y divide-[#E5E7EB] text-xs font-bold text-[#0E0E0E] shadow-2xs">
        <div className="pb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[#707070]">
            <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" />
            Daily Prayer Goal
          </span>
          <span className="font-mono-tabular font-black">{prayerTarget} min</span>
        </div>

        <div className="py-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[#707070]">
            <BookOpen size={16} weight="bold" className="text-emerald-700" />
            Daily Study Goal
          </span>
          <span className="font-mono-tabular font-black">{studyTarget} min</span>
        </div>

        <div className="py-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[#707070]">
            <Church size={16} className="text-[#FBBF24]" />
            Local Assembly
          </span>
          <span className="truncate max-w-[150px] font-black">{church || 'Local Assembly'}</span>
        </div>

        <div className="pt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[#707070]">
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
          className="py-4 px-5 rounded-2xl bg-white border border-[#E5E7EB] text-[#0E0E0E] font-bold text-xs hover:bg-[#FDF9F1] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <CaretLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          className="flex-1 py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <CircleNotch size={18} className="animate-spin text-[#0E0E0E]" />
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
