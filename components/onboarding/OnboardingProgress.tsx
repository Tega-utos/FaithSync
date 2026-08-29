'use client'

import React from 'react'

interface OnboardingProgressProps {
  currentStep: number
  totalSteps?: number
}

export function OnboardingProgress({
  currentStep,
  totalSteps = 4,
}: OnboardingProgressProps) {
  const percentage = Math.min(100, Math.round((currentStep / totalSteps) * 100))

  return (
    <div className="w-full space-y-2 select-none">
      <div className="flex items-center justify-between text-[11px] font-bold text-[#707070]">
        <span className="uppercase tracking-wider text-[10px]">Step {currentStep} of {totalSteps}</span>
        <span className="font-mono-tabular text-[#0E0E0E]">{percentage}% Complete</span>
      </div>

      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FBBF24] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default OnboardingProgress
