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

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/faithsync-timer-logo.png"
        alt="FaithSync"
        width={computedWidth || 160}
        height={typeof computedHeight === 'number' ? computedHeight : 36}
        style={{
          height: typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight,
          width: computedWidth ? (typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth) : 'auto',
          imageRendering: '-webkit-optimize-contrast',
        }}
        className="object-contain drop-shadow-2xs dark:brightness-0 dark:invert"
      />
    </div>
  )
}

export default Logo
