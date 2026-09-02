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
    primary:
      'bg-[#0E0E0E] hover:bg-[#262626] text-white shadow-md',
    secondary:
      'bg-[#234537] hover:bg-[#183329] text-white shadow-md shadow-[#234537]/20 border border-[#234537]/30',
    outline:
      'border border-border hover:border-[#234537] text-text-primary hover:bg-[#EBF3EE]',
    ghost:
      'text-text-secondary hover:text-text-primary hover:bg-subtle/60',
    danger:
      'bg-[#EA2C26] hover:bg-[#c9221d] text-white shadow-md shadow-[#EA2C26]/20',
    glow:
      'bg-[#FBBF24] hover:bg-[#eab308] text-text-primary font-bold shadow-lg shadow-[#FBBF24]/30',
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
