'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

interface LogoProps {
  size?: number | string
  width?: number | string
  height?: number | string
  className?: string
  priority?: boolean
  rounded?: boolean
}

export function Logo({
  size,
  width,
  height = 36,
  className = '',
  rounded = true,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const numSize =
    typeof size === 'number'
      ? size
      : typeof height === 'number'
      ? height
      : typeof width === 'number'
      ? width
      : 36

  const isDark = mounted ? resolvedTheme === 'dark' : false
  const iconSrc = isDark ? '/assets/app-icon-dark.png' : '/assets/app-icon-light.png'

  return (
    <div
      style={{ width: numSize, height: numSize }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${
        rounded ? 'rounded-2xl shadow-xs ring-1 ring-black/5 dark:ring-white/10' : ''
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconSrc}
        alt="FaithSync"
        width={numSize}
        height={numSize}
        className="w-full h-full object-cover transition-opacity duration-200"
      />
    </div>
  )
}

export default Logo
