// INSIGHT egress V2 staging helper.
// Isolated from login/auth/UI. Not used until a caller explicitly opts in.
import { backgroundGate, rpcValue } from "./egress-20260930.ts";

export type JobLeaseResult = {
  allowed: boolean;
  reason: "acquired" | "interval" | "maintenance";
  nextAllowedAt?: string | null;
};

export async function backgroundLeaseGate(
  db: any,
  request: Request,
  jobName: string,
  minIntervalSeconds: number,
): Promise<JobLeaseResult> {
  // Preserve the existing auth + maintenance boundary first.
  if (await backgroundGate(db, request)) {
    return { allowed: false, reason: "maintenance" };
  }

  const result = await rpcValue(db, "insight_egress_job_acquire_v2", {
    p_job_name: jobName,
    p_min_interval_seconds: Math.max(1, Math.floor(minIntervalSeconds)),
  });

  if (result?.allowed === true) {
    return {
      allowed: true,
      reason: "acquired",
      nextAllowedAt: result?.next_allowed_at || null,
    };
  }

  return {
    allowed: false,
    reason: "interval",
    nextAllowedAt: result?.next_allowed_at || null,
  };
}
