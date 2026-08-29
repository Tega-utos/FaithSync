'use client'

import React from 'react'
import { Check } from '@phosphor-icons/react'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export interface WeeklyProgressProps {
  completedDaysCount: number
  weekDots: ('completed' | 'today' | 'missed' | 'pending')[]
}

export function WeeklyProgress({ completedDaysCount, weekDots }: WeeklyProgressProps) {
  return (
    <div className="faith-card p-4 sm:p-5 space-y-3.5 bg-white border border-[#E5E7EB] shadow-xs">
      {/* Header & Counter */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0E0E0E]">
          Weekly Progress
        </h2>
        <span className="text-[11px] font-black uppercase font-mono-tabular tracking-wider text-[#707070]">
          <span className="text-[#FBBF24] font-black">{completedDaysCount}</span> / 7 DAYS COMPLETE
        </span>
      </div>

      {/* 7-Day Visual Tracker Spread */}
      <div className="grid grid-cols-7 gap-2 pt-1">
        {weekDots.map((status, index) => {
          const isCompleted = status === 'completed'
          const isToday = status === 'today'
          const isMissed = status === 'missed'

          return (
            <div key={index} className="flex flex-col items-center gap-2">
              {/* Day Letter Label */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isToday ? 'text-[#0E0E0E] font-black' : 'text-[#9095A1]'
                }`}
              >
                {DAY_LABELS[index]}
              </span>

              {/* Sleek Circular Day Dot Badge */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-[#FBBF24] text-[#0E0E0E] font-black shadow-[0_4px_14px_rgba(251,191,36,0.45)] scale-105'
                    : isToday
                    ? 'border-2 border-dashed border-[#9CA3AF] bg-[#F3F4F6]/70'
                    : isMissed
                    ? 'border-2 border-[#D1D5DB] bg-transparent flex items-center justify-center'
                    : 'border border-[#E5E7EB]/50 bg-transparent'
                }`}
              >
                {isCompleted ? (
                  <Check size={13} weight="bold" className="text-[#0E0E0E]" />
                ) : isMissed ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
