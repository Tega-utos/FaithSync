'use client'

import React from 'react'
import { SWRConfig } from 'swr'

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 10_000, // Deduplicate identical requests within 10 seconds
        keepPreviousData: true,    // Retain previous data during revalidation to eliminate screen flashes
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}
