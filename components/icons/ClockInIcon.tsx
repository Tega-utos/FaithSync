import React from 'react'

export interface ClockInIconProps {
  size?: number | string
  active?: boolean
  className?: string
  color?: string
  needleColor?: string
  accentTickColor?: string
  strokeWidth?: number | string
}

export function ClockInIcon({
  size = 22,
  active = false,
  className = '',
  color = 'currentColor',
  needleColor = '#FBBF24',
  accentTickColor = '#EA2C26',
  strokeWidth,
}: ClockInIconProps) {
  const sw = strokeWidth ?? (active ? '1.75' : '1.35')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-105' : ''} ${className}`}
    >
      {/* Top Stopwatch Push Button */}
      <path
        d="M15.1342 2.09154L10.1343 2.06104"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Outer Dial Circle & Top Right Push Tab */}
      <path
        d="M4.06384 13.524C4.09248 8.82968 7.92121 5.04739 12.6155 5.07603C14.9627 5.09036 17.0819 6.0547 18.6106 7.60225M18.6106 7.60225C20.1394 9.14981 21.0778 11.2806 21.0635 13.6277C21.0349 18.3221 17.2061 22.1044 12.5118 22.0757L3.01199 22.0178M18.6106 7.60225L20.1093 6.12178"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Red Accent Bottom Left Indicator Tick */}
      <path
        d="M8.03018 19.0486L3.03027 19.0181"
        stroke={accentTickColor || color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lower Left Indicator Tick */}
      <path
        d="M6.04877 16.0364L3.04883 16.0181"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dynamic Gold Center Clock Needle */}
      <path
        d="M12.5641 13.5761L16.0854 10.0975"
        stroke={needleColor || color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ClockInIcon
