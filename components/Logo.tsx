'use client'

import React from 'react'

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
  const computedHeight = size || height
  const computedWidth = width || (typeof computedHeight === 'number' ? Math.round(computedHeight * 4.47) : undefined)

  const hStyle = typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight
  const wStyle = computedWidth ? (typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth) : 'auto'

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {/* Light Mode Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/drk_logo.svg"
        alt="FaithSync"
        width={computedWidth || 160}
        height={typeof computedHeight === 'number' ? computedHeight : 36}
        style={{ height: hStyle, width: wStyle }}
        className="object-contain block dark:hidden drop-shadow-2xs"
      />
      {/* Dark Mode Crisp White Logo Variant */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/logo-white.svg"
        alt="FaithSync"
        width={computedWidth || 160}
        height={typeof computedHeight === 'number' ? computedHeight : 36}
        style={{ height: hStyle, width: wStyle }}
        className="object-contain hidden dark:block drop-shadow-2xs"
      />
    </div>
  )
}

export default Logo
