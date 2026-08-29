'use client'

import React from 'react'
import { HandsPraying, BookOpen, CaretRight } from '@phosphor-icons/react'

interface StepDisciplineTargetsProps {
  prayerTarget: number
  setPrayerTarget: (mins: number) => void
  studyTarget: number
  setStudyTarget: (mins: number) => void
  onNext: () => void
}

const PRESET_MINUTES = [10, 15, 30, 45, 60]

export function StepDisciplineTargets({
  prayerTarget,
  setPrayerTarget,
  studyTarget,
  setStudyTarget,
  onNext,
}: StepDisciplineTargetsProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">
          Set Daily Goals
        </h2>
        <p className="text-xs text-[#707070] max-w-xs mx-auto">
          Choose your baseline daily targets for prayer and scripture study. You can adjust these anytime in your profile.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Prayer Target Card */}
        <div className="p-4 rounded-3xl bg-[#FAF6EE] border border-[#E5E7EB] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
                <HandsPraying size={18} weight="fill" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#0E0E0E]">Daily Prayer</h3>
                <p className="text-[10px] text-[#707070]">Intentional communion</p>
              </div>
            </div>
            <span className="text-xs font-black font-mono-tabular text-[#0E0E0E] bg-white px-2.5 py-1 rounded-xl border border-[#E5E7EB] shadow-2xs">
              {prayerTarget} min
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {PRESET_MINUTES.map((mins) => (
              <button
                key={`prayer-${mins}`}
                type="button"
                onClick={() => setPrayerTarget(mins)}
                className={`py-2 rounded-xl text-xs font-bold font-mono-tabular transition-all cursor-pointer ${
                  prayerTarget === mins
                    ? 'bg-[#FBBF24] text-[#0E0E0E] shadow-xs scale-[1.02]'
                    : 'bg-white text-[#707070] border border-[#E5E7EB] hover:bg-[#FDF9F1]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* 2. Scripture Study Target Card */}
        <div className="p-4 rounded-3xl bg-[#FAF6EE] border border-[#E5E7EB] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <BookOpen size={18} weight="bold" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#0E0E0E]">Scripture Study</h3>
                <p className="text-[10px] text-[#707070]">Deep reflection in the Word</p>
              </div>
            </div>
            <span className="text-xs font-black font-mono-tabular text-[#0E0E0E] bg-white px-2.5 py-1 rounded-xl border border-[#E5E7EB] shadow-2xs">
              {studyTarget} min
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {PRESET_MINUTES.map((mins) => (
              <button
                key={`study-${mins}`}
                type="button"
                onClick={() => setStudyTarget(mins)}
                className={`py-2 rounded-xl text-xs font-bold font-mono-tabular transition-all cursor-pointer ${
                  studyTarget === mins
                    ? 'bg-[#FBBF24] text-[#0E0E0E] shadow-xs scale-[1.02]'
                    : 'bg-white text-[#707070] border border-[#E5E7EB] hover:bg-[#FDF9F1]'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onNext}
        className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Continue</span>
        <CaretRight size={16} weight="bold" />
      </button>
    </div>
  )
}

export default StepDisciplineTargets
