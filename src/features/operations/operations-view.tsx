"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { MetricCard } from "@/components/shared/metric-card";
import {
  CapabilityNote,
  ErrorState,
  ForbiddenState,
} from "@/components/shared/states";
import { OutboxStatusBadge } from "@/components/shared/status-badge";
import { CopyableId } from "@/components/shared/copyable-id";
import {
  DataCell,
  DataRow,
  DataTable,
  DataTableBody,
  DataTableHead,
  HeaderCell,
  TableEmptyState,
  TableErrorState,
  TableSkeleton,
} from "@/components/shared/data-table";
import {
  useOutboxHealth,
  useParkedEvents,
  useRedriveAll,
  useRedriveEvent,
} from "@/features/operations/use-outbox";
import { messageFromError } from "@/lib/api/problem";
import { formatCount, formatDateTime, formatRelative } from "@/lib/utils";
import { PAGE_DEFAULT_SIZE } from "@/types/api";

/**
 * Transactional outbox operations.
 *
 * ---------------------------------------------------------------------------
 * Why this screen exists
 * ---------------------------------------------------------------------------
 * A payment commits in one transaction and its event is published to RabbitMQ
 * separately. The relay gives each event a bounded retry budget — roughly 30
 * minutes across twelve attempts — and then parks it, because retrying for
 * ever is the exact failure mode the outbox pattern exists to avoid.
 *
 * The cost of that choice is that a parked event needs a person: each one is a
 * committed payment whose event never reached the broker, so downstream
 * consumers never heard about money that genuinely moved. Nothing else in the
 * system surfaces those, and the backend deliberately has no scheduled
 * re-drive — automating it would turn the bounded retry back into an unbounded
 * one and hide whatever is actually broken.
 *
 * This is that person's screen.
 */
export function OperationsView() {
  const [page, setPage] = useState(0);

  const health = useOutboxHealth();
  const parked = useParkedEvents(page, PAGE_DEFAULT_SIZE);
  const redriveOne = useRedriveEvent();
  const redriveAll = useRedriveAll();

  if (health.isForbidden || parked.isForbidden) {
    return (
      <>
        <PageHeader title="Operations" />
        <ForbiddenState description="The outbox administration endpoints are restricted to the ADMIN role by the backend's filter chain." />
      </>
    );
  }

  const needsAttention = health.data?.needsAttention ?? false;
  const columns = 6;

  async function onRedriveAll() {
    try {
      const result = await redriveAll.mutateAsync();
      if (result.redriven === 0) {
        toast.info("Nothing to re-drive", {
          description: "No events are currently parked.",
        });
      } else if (result.redriven === result.limit) {
        toast.success(`${result.redriven} events re-driven`, {
          // The ceiling means there may well be more. Saying so is the whole
          // point of the backend returning the limit alongside the count.
          description: `That is the per-call ceiling, so more may remain. Run it again until it reports zero.`,
        });
      } else {
        toast.success(`${result.redriven} events re-driven`, {
          description: "They are pending again and the relay will pick them up.",
        });
      }
    } catch (error) {
      toast.error("Re-drive failed", {
        description: messageFromError(error),
      });
    }
  }

  async function onRedriveOne(eventId: string) {
    try {
      await redriveOne.mutateAsync(eventId);
      toast.success("Event re-driven", {
        description: "It is pending again with a fresh attempt budget.",
      });
    } catch (error) {
      toast.error("Re-drive failed", {
        description: messageFromError(error),
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Event delivery for committed payments. A parked event is a payment that succeeded but whose event never reached the broker."
        actions={
          needsAttention ? (
            <Button
              size="sm"
              onClick={() => void onRedriveAll()}
              disabled={redriveAll.isPending}
            >
              {redriveAll.isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Re-driving…
                </>
              ) : (
                <>
                  <RotateCcw aria-hidden="true" />
                  Re-drive all parked
                </>
              )}
            </Button>
          ) : null
        }
      />

      {/* ---------------------------------------------------------------
          Health
      --------------------------------------------------------------- */}
      {health.isError ? (
        <ErrorState
          message={messageFromError(health.error)}
          onRetry={() => void health.refetch()}
        />
      ) : (
        <>
          {needsAttention ? (
            // `assertive`: stranded payment events are the one condition on
            // this screen that genuinely should interrupt.
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 rounded-[--radius-card] border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
            >
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  {formatCount(health.data?.parked)} payment{" "}
                  {health.data?.parked === 1 ? "event is" : "events are"}{" "}
                  stranded
                </p>
                <p className="mt-0.5">
                  Each one is a committed payment whose event never reached the
                  broker. Triage the cause below before re-driving — an event
                  with a high re-drive count is telling you that re-driving is
                  not the fix.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Parked"
              Icon={AlertTriangle}
              tone={needsAttention ? "danger" : "success"}
              isLoading={health.isLoading}
              value={formatCount(health.data?.parked)}
              caption="Retry budget spent, waiting for an operator"
            />
            <MetricCard
              label="Pending"
              Icon={Send}
              tone="info"
              isLoading={health.isLoading}
              value={formatCount(health.data?.pending)}
              caption="Normally near zero; a rising count means the broker is unreachable"
            />
            <MetricCard
              label="Published"
              Icon={CheckCircle2}
              tone="success"
              isLoading={health.isLoading}
              value={formatCount(health.data?.published)}
              caption="Accepted by the broker, inside the 7-day retention window"
            />
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------
          Parked events
      --------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Parked events, longest stranded first
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DataTable
            caption="Outbox events that spent their retry budget"
            captionId="parked-table-caption"
          >
            <DataTableHead>
              <DataRow className="hover:bg-transparent">
                <HeaderCell>Event</HeaderCell>
                <HeaderCell>Payment</HeaderCell>
                <HeaderCell align="end">Attempts</HeaderCell>
                <HeaderCell>Last error</HeaderCell>
                <HeaderCell>Parked</HeaderCell>
                <HeaderCell align="end">Action</HeaderCell>
              </DataRow>
            </DataTableHead>

            {parked.isError ? (
              <TableErrorState
                columns={columns}
                message={messageFromError(parked.error)}
                onRetry={() => void parked.refetch()}
              />
            ) : parked.isLoading ? (
              <TableSkeleton columns={columns} />
            ) : !parked.data?.content.length ? (
              <TableEmptyState
                columns={columns}
                title="Nothing is parked"
                description="Every payment event has reached the broker. This is the state you want."
              />
            ) : (
              <DataTableBody>
                {parked.data.content.map((event) => (
                  <DataRow key={event.eventId}>
                    <DataCell label="Event">
                      <div className="flex flex-col items-start gap-1">
                        <CopyableId value={event.eventId} label="event id" />
                        <OutboxStatusBadge status={event.status} />
                      </div>
                    </DataCell>

                    <DataCell label="Payment">
                      {/* `aggregateId` is the payment transaction id, so the
                          payment itself is readable through the payment
                          endpoints. The event body is not returned. */}
                      <CopyableId
                        value={event.aggregateId}
                        label="payment id"
                      />
                    </DataCell>

                    <DataCell label="Attempts" align="end" numeric>
                      <div className="flex flex-col items-end">
                        <span>{event.attempts}</span>
                        {event.redriveCount > 0 ? (
                          <span
                            className="text-xs text-warning-700"
                            title="A high re-drive count means re-driving is not the fix"
                          >
                            {event.redriveCount}× re-driven
                          </span>
                        ) : null}
                      </div>
                    </DataCell>

                    <DataCell label="Last error">
                      {event.lastError ? (
                        <span
                          className="line-clamp-2 max-w-72 font-mono text-xs text-danger-700"
                          title={event.lastError}
                        >
                          {event.lastError}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DataCell>

                    <DataCell label="Parked">
                      {event.failedAt ? (
                        <time
                          dateTime={event.failedAt}
                          className="text-muted-foreground"
                          title={formatDateTime(event.failedAt)}
                        >
                          {formatRelative(event.failedAt)}
                        </time>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DataCell>

                    <DataCell label="" align="end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          redriveOne.isPending &&
                          redriveOne.variables === event.eventId
                        }
                        onClick={() => void onRedriveOne(event.eventId)}
                      >
                        {redriveOne.isPending &&
                        redriveOne.variables === event.eventId ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw aria-hidden="true" />
                        )}
                        Re-drive
                      </Button>
                    </DataCell>
                  </DataRow>
                ))}
              </DataTableBody>
            )}
          </DataTable>

          {parked.data ? (
            <Pagination
              result={parked.data}
              noun="parked events"
              isBusy={parked.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <CapabilityNote>
        <span className="font-medium">Re-driving is safe to repeat. </span>A
        parked event is one the broker never confirmed, so replaying it cannot
        duplicate a confirmed publication. In the one case where it might — a
        confirmation lost rather than never sent — the consumer deduplicates on
        the event id, which does not change across a re-drive.
      </CapabilityNote>
    </>
  );
}
