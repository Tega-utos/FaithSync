'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { fetchGroups, GroupItem } from '@/features/groups/services/groupService'

export const GROUPS_CACHE_KEY = 'sync_groups_data'

export function useGroupsData() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<GroupItem[]>(
    GROUPS_CACHE_KEY,
    () => fetchGroups(true),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10_000,
      keepPreviousData: true,
    }
  )

  return {
    groups: data || [],
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  }
}

export function invalidateGroupsData() {
  globalMutate(GROUPS_CACHE_KEY)
}
