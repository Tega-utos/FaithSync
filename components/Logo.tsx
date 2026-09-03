'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

interface LogoProps {
  size?: number | string
  width?: number | string
  height?: number | string
  className?: string
  priority?: boolean
}

export function Logo({
  size,
  width,
  height = 36,
  className = '',
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const computedHeight = size || height
  const computedWidth = width || (typeof computedHeight === 'number' ? Math.round(computedHeight * 4.47) : undefined)

  const hStyle = typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight
  const wStyle = computedWidth ? (typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth) : 'auto'

  const isDark = mounted ? resolvedTheme === 'dark' : false

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
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
