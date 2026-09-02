'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function WelcomePage() {
  return (
    <div className="command-center-container min-h-screen min-h-[100dvh] bg-card flex flex-col select-none">
      {/* 1. Hero Photograph (Expanded with tight 20px top / 16px side margins) */}
      <div className="px-4 pt-5 w-full flex justify-center animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="relative w-full max-w-[420px] aspect-[521/582] max-h-[48vh]">
          <Image
            src="/assets/welcome-hero-fellowship.png"
            alt="FaithSync Fellowship and Accountability"
            fill
            priority
            quality={100}
            unoptimized
            sizes="(max-width: 480px) 100vw, 420px"
            className="object-contain w-full h-full"
          />
        </div>
      </div>

      {/* 2. Cohesive Content Block (Fixed flex-start + tight intentional spacing) */}
      <div className="flex-1 flex flex-col justify-start px-7 pt-6 pb-6 max-w-[420px] mx-auto w-full">
        {/* Label -> Logo -> Subtext (Tight grouping) */}
        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-[13px] font-semibold text-text-secondary mb-1.5">
            Welcome to
          </p>

          <div className="mb-3">
            <Logo height={32} priority />
          </div>

          <p className="text-[13.5px] text-[#4A4A4A] leading-[1.45] mb-6">
            A faith-centered space to keep you consistent in the faith layered with support of people so you are never alone.
          </p>
        </div>

        {/* 3. Action Buttons */}
        <div className="space-y-3 relative z-20 animate-fade-up" style={{ animationDelay: '0.35s' }}>
          {/* Primary Action: Get Started */}
          <Link href="/signup" className="block w-full">
            <button
              type="button"
              className="w-full py-4 px-6 rounded-[30px] bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all cursor-pointer"
            >
              Get Started
            </button>
          </Link>

          {/* Secondary Action: I Already Have an Account */}
          <Link href="/login" className="block w-full">
            <button
              type="button"
              className="w-full py-3.5 px-6 rounded-[30px] bg-transparent border-2 border-dashed border-[#FBBF24] text-text-primary font-black text-sm hover:bg-[#FDF9F1] active:scale-[0.98] transition-all cursor-pointer"
            >
              I Already Have an Account
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
