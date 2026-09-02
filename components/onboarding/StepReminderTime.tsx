'use client'

import React from 'react'
import { Bell, Church, CaretRight, CaretLeft, Clock } from '@phosphor-icons/react'

interface StepReminderTimeProps {
  church: string
  setChurch: (val: string) => void
  prayerReminderTime: string
  setPrayerReminderTime: (val: string) => void
  studyReminderTime: string
  setStudyReminderTime: (val: string) => void
  allowNotifications: boolean
  setAllowNotifications: (val: boolean) => void
  onNext: () => void
  onBack: () => void
}

export function StepReminderTime({
  church,
  setChurch,
  prayerReminderTime,
  setPrayerReminderTime,
  studyReminderTime,
  setStudyReminderTime,
  allowNotifications,
  setAllowNotifications,
  onNext,
  onBack,
}: StepReminderTimeProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black text-text-primary tracking-tight">
          Assembly & Routine
        </h2>
        <p className="text-xs text-text-secondary max-w-xs mx-auto">
          Connect your church assembly and schedule your gentle daily reminders.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Local Assembly */}
        <div className="p-4 rounded-3xl bg-surface border border-border space-y-2 shadow-2xs">
          <label className="block text-xs font-black text-text-primary flex items-center gap-1.5">
            <Church size={16} className="text-[#FBBF24]" />
            <span>Local Assembly (Church)</span>
          </label>
          <input
            type="text"
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            placeholder="e.g. Grace Fellowship, City Church"
            className="w-full px-3.5 py-3 rounded-2xl bg-card border border-border text-xs font-bold text-text-primary placeholder-[#9095A1] outline-none focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/20 transition-all shadow-2xs"
          />
        </div>

        {/* 2. Daily Reminders Card */}
        <div className="p-4 rounded-3xl bg-surface border border-border space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
                <Bell size={18} weight="fill" />
              </div>
              <div>
                <h3 className="text-xs font-black text-text-primary">Daily Reminders</h3>
                <p className="text-[10px] text-text-secondary">Gentle nudges to keep your streak</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allowNotifications}
                onChange={(e) => setAllowNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FBBF24]" />
            </label>
          </div>

          {allowNotifications && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary block">Morning Prayer</label>
                <div className="relative">
                  <input
                    type="time"
                    value={prayerReminderTime}
                    onChange={(e) => setPrayerReminderTime(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text-primary shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary block">Evening Study</label>
                <div className="relative">
                  <input
                    type="time"
                    value={studyReminderTime}
                    onChange={(e) => setStudyReminderTime(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text-primary shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="py-4 px-5 rounded-2xl bg-card border border-border text-text-primary font-bold text-xs hover:bg-[#FDF9F1] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CaretLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Continue</span>
          <CaretRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}

export default StepReminderTime
