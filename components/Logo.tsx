'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

interface LogoProps {
  size?: number | string
  width?: number | string
  height?: number | string
  className?: string
  priority?: boolean
  showIcon?: boolean
  iconOnly?: boolean
}

export function Logo({
  size,
  width,
  height = 36,
  className = '',
  showIcon = true,
  iconOnly = false,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const numHeight = typeof size === 'number' ? size : typeof height === 'number' ? height : 36
  const isDark = mounted ? resolvedTheme === 'dark' : false

  const iconSrc = isDark ? '/assets/app-icon-dark.png' : '/assets/app-icon-light.png'

  if (iconOnly) {
    return (
      <div
        style={{ width: numHeight, height: numHeight }}
        className={`relative inline-flex items-center justify-center shrink-0 select-none rounded-2xl overflow-hidden shadow-xs ring-1 ring-black/5 dark:ring-white/10 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt="FaithSync"
          width={numHeight}
          height={numHeight}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
      </div>
    )
  }

  const computedHeight = size || height
  const computedWidth = width || (typeof computedHeight === 'number' ? Math.round(computedHeight * 4.47) : undefined)
  const hStyle = typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight
  const wStyle = computedWidth ? (typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth) : 'auto'

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {showIcon && (
        <div
          style={{ width: Math.round(numHeight * 0.95), height: Math.round(numHeight * 0.95) }}
          className="relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-2xs ring-1 ring-black/5 dark:ring-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconSrc}
            alt="FaithSync Icon"
            width={Math.round(numHeight * 0.95)}
            height={Math.round(numHeight * 0.95)}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isDark ? '/assets/logo-white.svg' : '/assets/drk_logo.svg'}
        alt="FaithSync"
        width={computedWidth || 160}
        height={typeof computedHeight === 'number' ? computedHeight : 36}
        style={{ height: hStyle, width: wStyle }}
        className="object-contain drop-shadow-2xs"
      />
    </div>
  )
}

export default Logo
