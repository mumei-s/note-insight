import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { EvidenceUploader } from "./evidence-uploader";

export function DashboardShell() {
  return (
    <>
      <CombinedAnalyticsApp />
      <EvidenceUploader />
    </>
  );
}
