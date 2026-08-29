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
          className={`block text-[11px] font-bold tracking-tight ${
            hasError ? 'text-[#EA2C26]' : 'text-[#707070]'
          }`}
        >
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center rounded-2xl bg-white border transition-all shadow-2xs ${
          hasError
            ? 'border-[#EA2C26] ring-2 ring-[#EA2C26]/10'
            : 'border-[#E5E7EB] focus-within:border-[#0E0E0E] focus-within:ring-1 focus-within:ring-black/10'
        } ${className}`}
      >
        {icon && (
          <div className="pl-3.5 pr-2 text-[#9095A1] shrink-0 flex items-center justify-center">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          type={computedType}
          className={`w-full bg-transparent px-3.5 py-3 text-xs font-bold text-[#0E0E0E] placeholder-[#9095A1] outline-none ${
            icon ? 'pl-1' : ''
          } ${isPassword ? 'pr-10' : ''}`}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 p-1 text-[#9095A1] hover:text-[#0E0E0E] transition-colors cursor-pointer"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {(hasError || helperText) && (
        <p
          className={`text-[10px] font-bold px-1 ${
            hasError ? 'text-[#EA2C26]' : 'text-[#9095A1]'
          }`}
        >
          {typeof error === 'string' ? error : helperText}
        </p>
      )}
    </div>
  )
}

export default AuthInput
