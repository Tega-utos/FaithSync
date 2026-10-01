'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

interface AppIconProps {
  size?: number
  className?: string
  rounded?: boolean
  alt?: string
  priority?: boolean
}

export function AppIcon({
  size = 40,
  className = '',
  rounded = true,
  alt = 'FaithSync Official App Icon',
}: AppIconProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${
        rounded ? 'rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10' : ''
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isDark ? '/assets/app-icon-dark.png' : '/assets/app-icon-light.png'}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-cover transition-opacity duration-200"
      />
    </div>
  )
}

export default AppIcon
