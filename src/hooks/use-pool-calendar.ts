import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { POOL_CALENDAR_QUERY } from '@/data/pool';
import { buildCalendarIndex, type RawDailyRow } from '@/data/pool-adapter';
import type { CalendarIndexData, ChannelId } from '@/components/SovraWaterfall/types';

export interface UsePoolCalendarReturn extends CalendarIndexData {
  loading: boolean;
}

/**
 * Per-channel calendar heatmap from wallet_flow_daily. Lazy: only runs when
 * `enabled` (the channel is expanded). Returns the CalendarIndexData shape the
 * CalendarPicker already consumes (dayMap keyed 'Y-M0-D', years, min/max ts).
 */
export function usePoolCalendar(
  accounts: string[] | null,
  channel: ChannelId,
  enabled: boolean,
): UsePoolCalendarReturn {
  const { data, loading } = useQuery(POOL_CALENDAR_QUERY, {
    variables: { accounts, channel },
    skip: !accounts?.length || !enabled,
    fetchPolicy: 'cache-first',
  });
  const cal = useMemo(() => buildCalendarIndex((data?.rows ?? []) as RawDailyRow[]), [data]);
  return { ...cal, loading };
}
