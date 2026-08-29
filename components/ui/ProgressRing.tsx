'use client'

import React from 'react'

export interface ProgressRingProps {
  progress: number // 0 to 100
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  children?: React.ReactNode
  showPercent?: boolean
  className?: string
  glow?: boolean
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#6366f1', // default indigo
  trackColor = '#1e293b',
  children,
  showPercent = false,
  className = '',
  glow = false,
}: ProgressRingProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className={`transform -rotate-90 origin-center ${
          glow ? 'filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''
        }`}
      >
        {/* Background Track */}
        <circle
          stroke={trackColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Bar */}
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        {children ? (
          children
        ) : showPercent ? (
          <span className="text-lg font-bold text-white tracking-tight">
            {Math.round(normalizedProgress)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}
