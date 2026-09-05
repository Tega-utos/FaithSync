'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTimer } from '@/context/TimerContext'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'

function HomeNavIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`}
    >
      <path
        d="M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z"
        stroke={active ? '#F59E0B' : 'currentColor'}
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 17C14.2005 17.6224 13.1502 18 12 18C10.8497 18 9.79953 17.6224 9 17"
        stroke={active ? '#EF4444' : 'currentColor'}
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TimerNavIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-105' : 'opacity-70 group-hover:opacity-100'}`}
    >
      <path
        d="M15.1342 2.09154L10.1343 2.06104"
        stroke="currentColor"
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.06384 13.524C4.09248 8.82968 7.92121 5.04739 12.6155 5.07603C14.9627 5.09036 17.0819 6.0547 18.6106 7.60225M18.6106 7.60225C20.1394 9.14981 21.0778 11.2806 21.0635 13.6277C21.0349 18.3221 17.2061 22.1044 12.5118 22.0757L3.01199 22.0178M18.6106 7.60225L20.1093 6.12178"
        stroke="currentColor"
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.03018 19.0486L3.03027 19.0181"
        stroke={active ? '#EA2C26' : 'currentColor'}
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.04877 16.0364L3.04883 16.0181"
        stroke="currentColor"
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5641 13.5761L16.0854 10.0975"
        stroke={active ? '#FBBF24' : 'currentColor'}
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SyncNavIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-105' : 'opacity-70 group-hover:opacity-100'}`}
    >
      <path
        d="M7.82142 19.0472C7.49589 18.9133 7.31605 18.8483 7.21516 18.8601C7.09116 18.8745 6.91058 19.0054 6.54942 19.267C5.91262 19.7284 5.11192 20.0577 3.9277 20.0218C3.32889 20.0036 3.02948 19.9945 2.89681 19.7662C2.76414 19.538 2.93303 19.2241 3.2708 18.5964C3.73926 17.7257 4.03879 16.7276 3.59905 15.9237C2.84026 14.7746 2.19806 13.4153 2.11193 11.951C2.06566 11.1642 2.07063 10.3497 2.1265 9.56351C2.41201 5.54612 5.60325 2.36414 9.58665 2.12501C10.9429 2.04361 12.3611 2.05207 13.7191 2.15023C17.6823 2.43673 20.8245 5.6313 21.0847 9.62798"
        stroke="currentColor"
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.7117 21.7362C12.2029 21.5599 10.2157 19.5914 10.0662 17.1343C10.0369 16.6534 10.04 16.1557 10.0751 15.6752C10.2545 13.2202 12.2656 11.276 14.7764 11.1303C15.633 11.0807 16.527 11.0862 17.3811 11.1462C19.8899 11.3226 21.8771 13.2911 22.0266 15.7482C22.0558 16.2291 22.0528 16.7268 22.0177 17.2072C21.9523 18.1014 21.5372 18.9271 21.0504 19.6235C20.7671 20.1114 20.9484 20.7236 21.237 21.2592C21.4451 21.6453 21.5492 21.8384 21.4638 21.9769C21.3785 22.1154 21.1896 22.1187 20.8121 22.1253C20.0655 22.1382 19.5634 21.931 19.1655 21.6441C18.9399 21.4815 18.827 21.4003 18.7489 21.3905C18.6709 21.3807 18.5168 21.4409 18.2088 21.5611C17.9319 21.6692 17.6107 21.735 17.3164 21.752C16.4616 21.8017 15.5676 21.7964 14.7117 21.7362Z"
        stroke={active ? '#FBBF24' : 'currentColor'}
        strokeWidth={active ? '1.75' : '1.35'}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const { session, isSummaryOpen } = useTimer()
  const [hasModalOpen, setHasModalOpen] = React.useState(false)

  React.useEffect(() => {
    const checkModals = () => {
      if (typeof document === 'undefined') return
      // Detect ANY fixed full-screen overlay, backdrop, dialog, or modal
      const overlayEls = document.querySelectorAll(
        '[role="dialog"], [data-modal="true"], [aria-modal="true"], #session-summary-modal, .session-summary-active, [class*="fixed inset-0"], .fixed.inset-0'
      )
      let hasOverlay = false
      for (let i = 0; i < overlayEls.length; i++) {
        const el = overlayEls[i]
        // Ignore bottom-nav itself and any elements inside it
        if (!el.closest('#bottom-nav') && !el.closest('.faithsync-bottom-nav')) {
          const style = window.getComputedStyle(el)
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            hasOverlay = true
            break
          }
        }
      }
      const isBodyModal =
        document.body.classList.contains('modal-open') ||
        document.documentElement.classList.contains('modal-open')
      setHasModalOpen(Boolean(hasOverlay || isBodyModal))
    }

    checkModals()

    const observer = new MutationObserver(() => {
      checkModals()
    })

    if (typeof document !== 'undefined' && document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      })
      window.addEventListener('click', checkModals)
      window.addEventListener('keydown', checkModals)
    }

    return () => {
      observer.disconnect()
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', checkModals)
        window.removeEventListener('keydown', checkModals)
      }
    }
  }, [])

  const isVisible = shouldShowAppShell(pathname)

  // Hide BottomNav in Community Square (/square), Chat (/buddy-chat, /group-chat), Bible Reader (/bible), Session Summary, when popup is open, or when any modal is active
  if (
    !isVisible ||
    pathname?.startsWith('/square') ||
    pathname?.startsWith('/buddy-chat') ||
    pathname?.startsWith('/group-chat') ||
    pathname?.startsWith('/bible') ||
    pathname?.startsWith('/session-summary') ||
    isSummaryOpen ||
    hasModalOpen
  ) {
    return null
  }

  const isHome = pathname === '/' || pathname === '/home'
  const isClockIn = pathname === '/clock-in'
  const isSync =
    pathname.startsWith('/sync') ||
    pathname.startsWith('/find-buddy') ||
    pathname.startsWith('/accountability')

  return (
    <nav
      id="bottom-nav"
      className="faithsync-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center pb-[max(14px,env(safe-area-inset-bottom))] px-3 sm:px-4"
    >
      <div className="w-full max-w-[min(380px,calc(100vw-24px))] pointer-events-auto bg-white/85 dark:bg-[#18140E]/90 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_1px_1px_rgba(255,255,255,0.05)] px-2 py-1.5 grid grid-cols-3 items-center gap-1.5 transition-all">
        {/* ========================================================================= */}
        {/* 1. HOME (/home or /)                                                      */}
        {/* ========================================================================= */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 group relative active:scale-90 ${
            isHome
              ? 'text-text-primary dark:text-[#F5F1E8] bg-black/[0.05] dark:bg-white/[0.07]'
              : 'text-neutral-400 dark:text-neutral-500 hover:text-text-primary dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <HomeNavIcon active={isHome} />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${
              isHome
                ? 'font-bold text-text-primary dark:text-[#F5F1E8]'
                : 'font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-text-primary dark:group-hover:text-neutral-300'
            }`}
          >
            Home
          </span>
        </Link>

        {/* ========================================================================= */}
        {/* 2. CLOCK-IN (/clock-in - Dead-Center Core Mechanic)                       */}
        {/* ========================================================================= */}
        <Link
          href="/clock-in"
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 group relative active:scale-90 ${
            isClockIn
              ? 'text-text-primary dark:text-[#F5F1E8] bg-black/[0.05] dark:bg-white/[0.07]'
              : 'text-neutral-400 dark:text-neutral-500 hover:text-text-primary dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <TimerNavIcon active={isClockIn || !!session?.isActive} />
            {session?.isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#18140E] animate-ping" />
            )}
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${
              isClockIn
                ? 'font-bold text-text-primary dark:text-[#F5F1E8]'
                : 'font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-text-primary dark:group-hover:text-neutral-300'
            }`}
          >
            {session?.isActive ? 'Timing' : 'Clock-In'}
          </span>
        </Link>

        {/* ========================================================================= */}
        {/* 3. SYNC (/sync - Social & Community Hub)                                  */}
        {/* ========================================================================= */}
        <Link
          href="/sync"
          className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 group relative active:scale-90 ${
            isSync
              ? 'text-text-primary dark:text-[#F5F1E8] bg-black/[0.05] dark:bg-white/[0.07]'
              : 'text-neutral-400 dark:text-neutral-500 hover:text-text-primary dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <SyncNavIcon active={isSync} />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight transition-colors duration-200 ${
              isSync
                ? 'font-bold text-text-primary dark:text-[#F5F1E8]'
                : 'font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-text-primary dark:group-hover:text-neutral-300'
            }`}
          >
            SynC
          </span>
        </Link>
      </div>
    </nav>
  )
}
