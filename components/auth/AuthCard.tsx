'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X } from '@phosphor-icons/react'
import { Logo } from '@/components/Logo'

interface AuthCardProps {
  children: React.ReactNode
  subtitle?: string
  closeHref?: string
  onClose?: () => void
  showClose?: boolean
  className?: string
}

export function AuthCard({
  children,
  subtitle = 'Sync Up!',
  closeHref = '/welcome',
  onClose,
  showClose = true,
  className = '',
}: AuthCardProps) {
  return (
    <div className="command-center-container relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-end bg-black overflow-hidden select-none">
      {/* 1. Blurred & Dimmed Hero Image Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Image
          src="/assets/welcome-hero-fellowship.png"
          alt="FaithSync background"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 440px"
          className="object-cover object-center filter blur-[10px] scale-105 opacity-50"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* 2. Glassmorphic Beige Modal Card */}
      <div
        className={`relative z-10 w-full bg-[#FAF6EE] rounded-t-[32px] p-6 sm:p-7 shadow-[0_-10px_40px_rgba(0,0,0,0.35)] border-t border-white/60 animate-slide-up space-y-4 ${className}`}
      >
        {/* Absolute Anchored Close Button (Top-Right) */}
        {showClose && (
          <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-20">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#707070] hover:text-[#0E0E0E] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} weight="bold" />
              </button>
            ) : (
              <Link
                href={closeHref}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#707070] hover:text-[#0E0E0E] transition-colors"
                aria-label="Close"
              >
                <X size={16} weight="bold" />
              </Link>
            )}
          </div>
        )}

        {/* Centralized Header with Logo and Subtitle Underneath */}
        <div className="flex flex-col items-center justify-center text-center pt-1 pb-0.5 space-y-1.5">
          <Logo height={32} priority />
          {subtitle && (
            <p className="text-xs font-bold text-[#707070] tracking-tight">
              {subtitle}
            </p>
          )}
        </div>

        {/* Modal Content */}
        {children}
      </div>
    </div>
  )
}

export default AuthCard
