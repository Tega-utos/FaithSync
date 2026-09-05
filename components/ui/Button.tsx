import React from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glow'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]'

  const variants = {
    // Fixed: Dedicated dark surface and near-white text across both themes
    primary:
      'bg-[var(--surface-dark-fixed)] hover:bg-[#26211B] text-[var(--text-on-dark-fixed)] shadow-md border border-white/10',
    // Theme-aware: Flips between surface-card and surface-sunken with theme text
    secondary:
      'bg-card hover:bg-subtle text-text-primary border border-border shadow-2xs',
    // Theme-aware: Transparent with theme border and text
    outline:
      'border border-border hover:border-text-secondary text-text-primary hover:bg-subtle/50',
    // Theme-aware: Subtle interactive button
    ghost:
      'text-text-secondary hover:text-text-primary hover:bg-subtle/60',
    // Fixed status: Danger / destructive action
    danger:
      'bg-[var(--danger)] hover:opacity-90 text-white shadow-md',
    // Accent: Gold background strictly requires dark text in BOTH modes for WCAG AAA contrast
    glow:
      'bg-[var(--accent)] hover:opacity-95 text-[var(--text-on-accent-fixed)] font-bold shadow-lg shadow-[#FBBF24]/25',
  }

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5',
    icon: 'p-2.5 aspect-square',
  }

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <CircleNotch size={16} className="animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  )
}
