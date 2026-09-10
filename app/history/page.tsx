'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Clock,
  CaretRight,
  CaretDown,
  Fire,
  BookOpen,
  CalendarBlank,
  Sparkle,
  HandsPraying,
  Printer,
  FileText,
  Check,
} from '@phosphor-icons/react'
import { useHistoryData } from '@/features/history/hooks/useHistoryData'

export default function HistoryPage() {
  const router = useRouter()
  const now = new Date()

  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1) // 1-12
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false)

  const {
    dailySummaries,
    prayerTarget,
    studyTarget,
    userName,
    monthLabel,
    completedDays,
    totalDaysInMonth,
    elapsedDaysInMonth,
    totalMinutesMonth,
    consistencyPercent,
    earliestDateKey,
    isLoading: loading,
    mutate,
  } = useHistoryData(selectedYear, selectedMonth)

  useEffect(() => {
    const handleUpdate = () => mutate()
    window.addEventListener('faithsync_session_updated', handleUpdate)
    window.addEventListener('focus', handleUpdate)
    return () => {
      window.removeEventListener('faithsync_session_updated', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
    }
  }, [mutate])

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1

  // Generate selectable months from earliest recorded date / signup up to current month
  const availableMonths = useMemo(() => {
    const months: Array<{ year: number; month: number; label: string; isCurrent: boolean }> = []
    const currentY = now.getFullYear()
    const currentM = now.getMonth() + 1

    let startY = currentY
    let startM = 1
    if (earliestDateKey) {
      const [eY, eM] = earliestDateKey.split('-').map(Number)
      if (!isNaN(eY) && !isNaN(eM)) {
        startY = eY
        startM = eM
      }
    } else {
      startY = currentY - 1
    }

    // Generate from current month backwards down to earliest month
    let y = currentY
    let m = currentM

    while (y > startY || (y === startY && m >= startM)) {
      const d = new Date(y, m - 1, 1)
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({
        year: y,
        month: m,
        label,
        isCurrent: y === currentY && m === currentM,
      })
      m--
      if (m === 0) {
        m = 12
        y--
      }
    }

    return months
  }, [earliestDateKey])

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth((prev) => prev - 1)
    }
    setIsMonthDropdownOpen(false)
  }

  const handleNextMonth = () => {
    if (isCurrentMonth) return
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth((prev) => prev + 1)
    }
    setIsMonthDropdownOpen(false)
  }

  const handleSelectMonth = (y: number, m: number) => {
    setSelectedYear(y)
    setSelectedMonth(m)
    setIsMonthDropdownOpen(false)
  }

  const handleJumpToCurrent = () => {
    setSelectedYear(now.getFullYear())
    setSelectedMonth(now.getMonth() + 1)
    setIsMonthDropdownOpen(false)
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4 print:p-0 print:m-0 print:max-w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border print:hidden">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary tracking-tight">Devotion Ledger</h1>

        <button
          type="button"
          onClick={handlePrint}
          className="px-3 py-1.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          title={`Print Devotion Ledger Statement for ${monthLabel}`}
        >
          <Printer size={15} className="text-[#FBBF24]" weight="bold" />
          <span>Print Statement</span>
        </button>
      </div>

      {/* Print Document Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 text-center border-b pb-4">
        <h1 className="text-2xl font-black tracking-tight text-black">FaithSync Devotion Ledger</h1>
        <p className="text-sm text-text-secondary mt-1">
          Spiritual Walk Record for <span className="font-bold">{userName}</span> • <span className="font-bold">{monthLabel}</span>
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          Generated on {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {completedDays} of {elapsedDaysInMonth} Days Complete ({consistencyPercent}%)
        </p>
      </div>

      {/* Month Navigation & Dropdown Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5 pb-1 print:hidden">
        {/* Left / Prev Button + Custom Month Dropdown Menu + Next Button */}
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-2xl p-1 shadow-xs w-full sm:w-auto justify-between sm:justify-start">
          {/* Prev Month Button */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
            title="Previous Month"
          >
            <CaretLeft size={16} weight="bold" />
          </button>

          {/* Month Dropdown Trigger */}
          <div className="relative flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-surface border border-border/80 hover:border-[#FBBF24] text-xs font-black text-text-primary flex items-center justify-between sm:justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <CalendarBlank size={15} className="text-[#FBBF24]" weight="bold" />
                <span>{monthLabel}</span>
              </div>
              <CaretDown
                size={13}
                weight="bold"
                className={`text-text-secondary transition-transform duration-200 ${
                  isMonthDropdownOpen ? 'rotate-180 text-[#FBBF24]' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Popup */}
            {isMonthDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsMonthDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 z-40 w-56 max-h-64 overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 no-scrollbar">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border/60">
                    Select Month
                  </div>
                  {availableMonths.map((m) => {
                    const isSelected = m.year === selectedYear && m.month === selectedMonth
                    return (
                      <button
                        key={`${m.year}-${m.month}`}
                        type="button"
                        onClick={() => handleSelectMonth(m.year, m.month)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] shadow-xs'
                            : 'text-text-primary hover:bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          {m.isCurrent && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                isSelected
                                  ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                                  : 'bg-[#FBBF24]/20 text-[#B45309] dark:text-[#FBBF24]'
                              }`}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        {isSelected && <Check size={14} weight="bold" />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Next Month Button (Disabled on Current Month) */}
          <button
            type="button"
            disabled={isCurrentMonth}
            onClick={handleNextMonth}
            className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 ${
              isCurrentMonth
                ? 'opacity-30 cursor-not-allowed text-text-muted'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface cursor-pointer active:scale-95'
            }`}
            title={isCurrentMonth ? 'Cannot navigate to future months' : 'Next Month'}
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        {/* Quick Return to Current Month Pill (When looking at a past month) */}
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={handleJumpToCurrent}
            className="px-3 py-1.5 rounded-xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/40 text-[#B45309] dark:text-[#FBBF24] hover:bg-[#FBBF24] hover:text-[#1A1610] text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
          >
            <Sparkle size={13} weight="fill" />
            <span>Jump to Current Month</span>
          </button>
        )}
      </div>

      {/* Summary Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Completed Days
          </span>
          <p className="text-lg font-black text-text-primary font-mono-tabular">
            {completedDays}{' '}
            <span className="text-xs font-normal text-text-secondary">
              / {elapsedDaysInMonth} {isCurrentMonth ? 'elapsed' : 'days'}
            </span>
          </p>
        </div>

        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Total Devotion Time
          </span>
          <p className="text-lg font-black text-text-primary font-mono-tabular">
            {Math.floor(totalMinutesMonth / 60)}h {totalMinutesMonth % 60}m
          </p>
        </div>

        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Monthly Consistency
          </span>
          <p className="text-lg font-black text-[#234537] dark:text-emerald-400 font-mono-tabular flex items-center gap-1">
            <span>{consistencyPercent}%</span>
            {consistencyPercent >= 80 && (
              <Fire size={16} weight="fill" className="text-[#EA2C26]" />
            )}
          </p>
        </div>

        <div className="faith-card p-3.5 bg-card border border-border space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Active Daily Targets
          </span>
          <p className="text-xs font-bold text-text-primary pt-1 flex items-center gap-2">
            <span className="text-[#FBBF24]">🙏 {prayerTarget}m</span>
            <span className="text-[#234537] dark:text-emerald-400">📖 {studyTarget}m</span>
          </p>
        </div>
      </div>

      {/* Horizontal Scroll Hint (Mobile only) */}
      <div className="flex items-center justify-between text-[11px] text-text-secondary px-1 print:hidden">
        <span className="font-medium flex items-center gap-1">
          <FileText size={14} className="text-[#FBBF24]" />
          <span>Spreadsheet Ledger • {monthLabel}</span>
        </span>
        <span className="text-[10px] text-text-muted sm:hidden">
          👉 Scroll horizontally
        </span>
      </div>

      {/* Ledger Spreadsheet or Loading */}
      {loading ? (
        <div className="py-20 text-center text-xs text-text-secondary">
          Loading devotion spreadsheet for {monthLabel}...
        </div>
      ) : dailySummaries.length === 0 ? (
        <div className="faith-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No logs recorded for {monthLabel}</h3>
          <p className="text-xs text-text-secondary">
            {isCurrentMonth
              ? 'Start your first timer session on the Clock-in screen to begin logging.'
              : 'No devotion records were found for this month.'}
          </p>
          {isCurrentMonth && (
            <Link href="/clock-in" className="inline-block pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-[#0E0E0E] dark:bg-neutral-800 dark:border dark:border-white/15 text-white text-xs font-bold hover:bg-[#262626] dark:hover:bg-neutral-700 transition-all cursor-pointer"
              >
                Clock In Now
              </button>
            </Link>
          )}
        </div>
      ) : (
        /* Unified Horizontal-Scroll Excel-Style Spreadsheet Table */
        <div className="faith-card overflow-hidden shadow-sm bg-card border border-border print:border-black print:shadow-none">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[580px] print:min-w-full">
              <thead>
                <tr className="bg-surface border-b border-border text-[10px] uppercase font-black tracking-wider text-text-secondary print:bg-gray-100 print:text-black">
                  <th className="py-3 px-3.5 border-r border-border/70">Date</th>
                  <th className="py-3 px-3.5 border-r border-border/70">Prayer Time</th>
                  <th className="py-3 px-3.5 border-r border-border/70">Study Time</th>
                  <th className="py-3 px-3.5 border-r border-border/70 text-center">Total</th>
                  <th className="py-3 px-3.5 border-r border-border/70 text-center">Daily Status</th>
                  <th className="py-3 px-3 text-right print:hidden">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-light bg-card print:divide-gray-300">
                {dailySummaries.map((day, idx) => (
                  <tr
                    key={day.dateKey}
                    onClick={() => {
                      if (!day.isFuture) {
                        router.push(`/session-details/date/${day.dateKey}`)
                      }
                    }}
                    className={`transition-colors group print:hover:bg-transparent ${
                      day.isFuture
                        ? 'opacity-40 cursor-default'
                        : 'hover:bg-surface/80 cursor-pointer'
                    } ${idx % 2 === 1 ? 'bg-surface/20' : 'bg-card'}`}
                  >
                    {/* 1. Date Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-bold text-text-primary border-r border-border-light">
                      <div className="flex items-center gap-1.5">
                        <CalendarBlank size={14} className="text-text-muted shrink-0" />
                        <span>{day.dateDisplay}</span>
                        {day.isToday && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold shrink-0">
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Prayer Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          day.isPrayerMet
                            ? 'bg-[#EBF3EE] dark:bg-emerald-950/30 text-[#234537] dark:text-emerald-400 border border-[#234537]/30 dark:border-emerald-700/35 font-black'
                            : day.prayerMinutes > 0
                            ? 'bg-surface text-text-primary border border-border'
                            : 'text-text-muted'
                        }`}
                      >
                        <HandsPraying size={12} weight="fill" />
                        <span>
                          {day.prayerMinutes} / {day.prayerTarget}m
                        </span>
                      </span>
                    </td>

                    {/* 3. Study Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          day.isStudyMet
                            ? 'bg-[#FDF9F1] dark:bg-amber-950/30 text-[#B45309] dark:text-[#FBBF24] border border-[#FBBF24]/40 dark:border-amber-500/30 font-black'
                            : day.studyMinutes > 0
                            ? 'bg-surface text-text-primary border border-border'
                            : 'text-text-muted'
                        }`}
                      >
                        <BookOpen size={12} weight="fill" />
                        <span>
                          {day.studyMinutes} / {day.studyTarget}m
                        </span>
                      </span>
                    </td>

                    {/* 4. Total Minutes Cell */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light text-center font-mono-tabular font-bold text-xs text-text-primary">
                      {day.totalMinutes > 0 ? `${day.totalMinutes}m` : '—'}
                    </td>

                    {/* 5. Daily Status Badge */}
                    <td className="py-3 px-3.5 whitespace-nowrap border-r border-border-light text-center">
                      {day.status === 'Complete' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ECFCCB] text-[#15803D] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border dark:border-emerald-700/30 text-[10px] font-black inline-flex items-center gap-1 shadow-2xs">
                          <Check size={11} weight="bold" /> Complete
                        </span>
                      ) : day.status === 'In Progress' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-300 dark:border dark:border-blue-700/30 text-[10px] font-bold inline-block">
                          In Progress
                        </span>
                      ) : day.status === 'Pending' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-subtle text-text-muted text-[10px] font-medium inline-block">
                          Upcoming
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] dark:bg-rose-950/40 dark:text-rose-300 dark:border dark:border-rose-700/30 text-[10px] font-bold inline-block opacity-75">
                          Missed
                        </span>
                      )}
                    </td>

                    {/* 6. Action Cell */}
                    <td className="py-3 px-3 whitespace-nowrap text-right print:hidden">
                      {!day.isFuture && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors">
                          <span>Details</span>
                          <CaretRight
                            size={13}
                            className="group-hover:translate-x-0.5 transition-transform"
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

