import { useEffect } from "react";
import { CombinedAnalyticsApp } from "./combined-analytics-app";
import { syncRelationsIfDue } from "./insight-relations-client";

export function InsightApp() {
  useEffect(() => {
    void syncRelationsIfDue();
  }, []);

  return <CombinedAnalyticsApp />;
}
