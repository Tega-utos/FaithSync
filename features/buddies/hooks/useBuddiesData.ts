'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { getMyBuddies, BuddyConnectionItem } from '@/features/buddies/services/buddyService'
import { createClient } from '@/lib/supabase/client'

export const BUDDIES_CACHE_KEY = 'sync_buddies_data'

interface BuddiesDataResult {
  active: BuddyConnectionItem[]
  pendingIncoming: BuddyConnectionItem[]
  pendingOutgoing: BuddyConnectionItem[]
  userId: string | null
}

export function useBuddiesData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<BuddiesDataResult | null>(
    BUDDIES_CACHE_KEY,
    async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const res = await getMyBuddies(user.id, true)
      return {
        ...res,
        userId: user.id,
      }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  return {
    buddiesData: data || null,
    activeBuddies: data?.active || [],
    incomingRequests: data?.pendingIncoming || [],
    outgoingRequests: data?.pendingOutgoing || [],
    userId: data?.userId || null,
    error,
    isLoading: isLoading && !data, // Only true loading on cold first fetch
    isValidating,
    mutate,
  }
}

export function invalidateBuddiesData() {
  globalMutate(BUDDIES_CACHE_KEY)
}
