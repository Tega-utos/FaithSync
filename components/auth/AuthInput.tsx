'use client'

import React, { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
  error?: string | boolean
  helperText?: string
}

export function AuthInput({
  label,
  icon,
  error,
  helperText,
  type = 'text',
  className = '',
  id,
  ...rest
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const computedType = isPassword ? (showPassword ? 'text' : 'password') : type

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  const hasError = Boolean(error)

  return (
    <div className="space-y-1.5 w-full text-left">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-[12px] font-medium tracking-normal ${
            hasError ? 'text-[#EA2C26] dark:text-red-400' : 'text-text-secondary'
          }`}
        >
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center rounded-2xl bg-surface/70 dark:bg-neutral-900/70 border transition-all ${
          hasError
            ? 'border-[#EA2C26] ring-2 ring-[#EA2C26]/10'
            : 'border-border/80 dark:border-white/15 focus-within:border-border focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10'
        } ${className}`}
      >
        {icon && (
          <div className="pl-3.5 pr-2 text-text-muted/70 shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          type={computedType}
          className={`w-full bg-transparent px-3.5 py-3 text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal outline-none antialiased tracking-normal ${
            icon ? 'pl-1' : ''
          } ${isPassword ? 'pr-10' : ''}`}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 p-1.5 text-text-muted/70 hover:text-text-primary transition-colors cursor-pointer"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {(hasError || helperText) && (
        <p
          className={`text-[11px] font-medium px-1 ${
            hasError ? 'text-[#EA2C26] dark:text-red-400' : 'text-text-muted'
          }`}
        >
          {typeof error === 'string' ? error : helperText}
        </p>
      )}
    </div>
  )
}

export default AuthInput
