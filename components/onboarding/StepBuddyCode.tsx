'use client'

import React, { useState } from 'react'
import { Users, Copy, Check, CaretRight, CaretLeft, UserPlus } from '@phosphor-icons/react'

interface StepBuddyCodeProps {
  userBuddyCode: string
  friendBuddyCode: string
  setFriendBuddyCode: (val: string) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function StepBuddyCode({
  userBuddyCode,
  friendBuddyCode,
  setFriendBuddyCode,
  onNext,
  onBack,
  onSkip,
}: StepBuddyCodeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && userBuddyCode) {
      navigator.clipboard.writeText(userBuddyCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">
          Accountability SynC
        </h2>
        <p className="text-xs text-[#707070] max-w-xs mx-auto">
          Share your code with a trusted friend or add their code to connect 1-on-1.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Your Personal Buddy Code Card */}
        <div className="p-5 rounded-3xl bg-[#FAF6EE] border border-[#E5E7EB] text-center space-y-2.5 shadow-2xs">
          <p className="text-[11px] font-bold text-[#707070] uppercase tracking-wider">
            Your SynC Code
          </p>

          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-xl font-black tracking-widest text-[#0E0E0E] bg-white px-4 py-2 rounded-2xl border border-[#E5E7EB] shadow-2xs">
              {userBuddyCode || 'SYNC-8821'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-3 rounded-2xl bg-white border border-[#E5E7EB] hover:bg-[#FDF9F1] text-[#0E0E0E] transition-colors shadow-2xs cursor-pointer"
              title="Copy SynC Code"
            >
              {copied ? (
                <Check size={18} className="text-emerald-600 font-bold" />
              ) : (
                <Copy size={18} className="text-[#FBBF24]" />
              )}
            </button>
          </div>

          <p className="text-[10px] text-[#9095A1]">
            {copied ? 'Copied to clipboard!' : 'Tap copy to share with your prayer partner'}
          </p>
        </div>

        {/* 2. Optional: Add Buddy Code Input */}
        <div className="p-4 rounded-3xl bg-[#FAF6EE] border border-[#E5E7EB] space-y-2 shadow-2xs">
          <label className="block text-xs font-black text-[#0E0E0E] flex items-center gap-1.5">
            <UserPlus size={16} className="text-[#FBBF24]" />
            <span>Have a friend&apos;s code? (Optional)</span>
          </label>
          <input
            type="text"
            value={friendBuddyCode}
            onChange={(e) => setFriendBuddyCode(e.target.value.toUpperCase())}
            placeholder="e.g. SYNC-4592"
            maxLength={12}
            className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#E5E7EB] font-mono text-xs font-bold text-[#0E0E0E] placeholder-[#9095A1] outline-none focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/20 uppercase transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="py-4 px-5 rounded-2xl bg-white border border-[#E5E7EB] text-[#0E0E0E] font-bold text-xs hover:bg-[#FDF9F1] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CaretLeft size={16} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue</span>
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        {/* Skip for now option */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-bold text-[#707070] hover:text-[#0E0E0E] transition-colors cursor-pointer py-1"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

export default StepBuddyCode
