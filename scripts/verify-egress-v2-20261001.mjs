import fs from "node:fs";
import assert from "node:assert/strict";

const files = [
  "supabase/functions/_shared/egress-v2-20261001.ts",
  "supabase/migrations/20261001_prepare_egress_job_throttle_v2.sql",
];

for (const file of files) assert(fs.existsSync(file), "missing " + file);

const helper = fs.readFileSync(files[0], "utf8");
const migration = fs.readFileSync(files[1], "utf8");

assert(helper.includes('from "./egress-20260930.ts"'));
assert(helper.includes("backgroundGate(db, request)"));
assert(helper.includes("insight_egress_job_acquire_v2"));

assert(migration.includes("private.insight_egress_job_throttle_v2"));
assert(migration.includes("grant execute on function public.insight_egress_job_acquire_v2(text, integer) to service_role"));
assert(migration.includes("revoke all on function public.insight_egress_job_acquire_v2(text, integer) from public, anon, authenticated"));
assert(!migration.match(/auth\.|member_sessions|insight_access|delete\s+from/i));

console.log("PASS: egress V2 staging is isolated from login/auth/session paths and is not active until callers opt in.");
