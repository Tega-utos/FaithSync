import React from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { House, ArrowLeft } from '@phosphor-icons/react/dist/ssr'

export default function NotFound() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF6EE] flex flex-col items-center justify-center px-6 py-12 text-center select-none">
      <div className="max-w-md w-full faith-card p-8 space-y-6 animate-fade-up">
        <div className="flex justify-center">
          <Logo height={36} />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-[#0E0E0E] tracking-tight">404</h1>
          <h2 className="text-lg font-bold text-[#0E0E0E]">Page Not Found</h2>
          <p className="text-xs text-[#707070] leading-relaxed">
            The page you are looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
          <Link
            href="/home"
            className="px-5 py-3 rounded-2xl bg-[#0E0E0E] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#234537] transition-colors shadow-sm"
          >
            <House size={16} weight="bold" />
            <span>Go to Home</span>
          </Link>
          <Link
            href="/welcome"
            className="px-5 py-3 rounded-2xl bg-[#F3F4F6] text-[#0E0E0E] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#E5E7EB] transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            <span>Back to Welcome</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
