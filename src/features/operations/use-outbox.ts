"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOutboxHealth,
  listParkedEvents,
  redriveAllParked,
  redriveEvent,
} from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/problem";
import type { RedriveResult } from "@/types/api";

/** ADMIN only, like every `/api/v1/admin/**` route. */
export function useOutboxHealth(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: queryKeys.outbox.health,
    queryFn: ({ signal }) => getOutboxHealth(signal),
    enabled: options.enabled ?? true,
    retry: false,
    // Health is the one figure here worth polling: a rising pending count
    // means the broker is unreachable right now, which is a live condition
    // rather than a historical one.
    refetchInterval: 30_000,
  });

  return {
    ...query,
    isForbidden: query.error instanceof ApiError && query.error.isForbidden,
  };
}

export function useParkedEvents(
  page: number,
  size: number,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: queryKeys.outbox.parked(page, size),
    queryFn: ({ signal }) => listParkedEvents({ page, size }, signal),
    enabled: options.enabled ?? true,
    retry: false,
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    isForbidden: query.error instanceof ApiError && query.error.isForbidden,
  };
}

/**
 * Returns one parked event to the relay.
 *
 * Safe to repeat. A parked event is one the broker never confirmed, so
 * replaying it cannot duplicate a confirmed publication; and in the one case
 * where it might — a confirmation that was lost rather than never sent — the
 * consumer deduplicates on the event id, which a re-drive does not change.
 */
export function useRedriveEvent() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (eventId) => redriveEvent(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outbox.all });
    },
  });
}

/**
 * Returns the oldest parked events to the relay, up to the backend's per-call
 * ceiling.
 *
 * Bounded on the backend's side, not here: the update takes a row lock per
 * event and an unbounded one could lock the table while the relay is draining
 * it. The response says how many moved, so the call is simply repeated until
 * it returns zero.
 */
export function useRedriveAll() {
  const queryClient = useQueryClient();

  return useMutation<RedriveResult, ApiError, void>({
    mutationFn: () => redriveAllParked(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outbox.all });
    },
  });
}
