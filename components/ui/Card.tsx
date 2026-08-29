import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive' | 'prayer' | 'word' | 'meditation'
  glow?: boolean
}

export function Card({
  className,
  variant = 'default',
  glow = false,
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-slate-900/80 border-slate-800/80 text-slate-100',
    elevated: 'bg-slate-800/90 border-slate-700/80 text-slate-100 shadow-xl',
    glass: 'bg-slate-900/50 backdrop-blur-md border-slate-800/60 text-slate-100 shadow-xl',
    interactive:
      'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700 text-slate-100 transition-all duration-200 cursor-pointer hover:shadow-lg',
    prayer: 'bg-indigo-950/20 border-indigo-500/20 text-indigo-100',
    word: 'bg-amber-950/20 border-amber-500/20 text-amber-100',
    meditation: 'bg-emerald-950/20 border-emerald-500/20 text-emerald-100',
  }

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl border p-5 transition-all relative overflow-hidden',
          variants[variant],
          glow && 'shadow-lg shadow-indigo-500/10',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={twMerge('text-base font-semibold tracking-tight text-white', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge('text-xs text-slate-400', className)} {...props}>
      {children}
    </p>
  )
}
