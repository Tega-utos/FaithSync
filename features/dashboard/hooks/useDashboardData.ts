'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { fetchDashboardData, DashboardData } from '@/features/dashboard/services/dashboardService'

export const DASHBOARD_CACHE_KEY = 'dashboard_data'

export function useDashboardData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardData | null>(
    DASHBOARD_CACHE_KEY,
    () => fetchDashboardData(true),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  return {
    dashboard: data || null,
    error,
    isLoading: isLoading && !data, // Only show true loading when no cached data exists
    isValidating,
    mutate,
  }
}

export function invalidateDashboardData() {
  globalMutate(DASHBOARD_CACHE_KEY)
}
