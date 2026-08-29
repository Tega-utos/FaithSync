import React from 'react'

export function Logo({
  size,
  width,
  height = 36,
  className = '',
}) {
  const computedHeight = size || height
  const computedWidth = width || (typeof computedHeight === 'number' ? Math.round(computedHeight * 4.47) : undefined)

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
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
        className="object-contain drop-shadow-2xs"
      />
    </div>
  )
}

export default Logo
