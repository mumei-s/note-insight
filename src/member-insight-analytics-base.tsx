import { useEffect, useRef } from "react";
import "./insight-analysis-rate-guard";
import { MemberInsightAnalyticsFinal } from "./member-insight-analytics-final";
import "./member-insight-analytics-base.css";

const SCOPE_KEY = "mumei-analysis-scope-v11";
const RATE_CONTEXT = /(率|PV化|反応|流入|依存|集中|検索|通知|外部|直接\/不明)/;
const CHANGE_CONTEXT = /(前7日比|前回比|増減|前年差|伸び率)/;

function clampRenderedRates(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const parentText = textNode.parentElement?.textContent || "";
    const raw = textNode.nodeValue || "";
    if (!raw.includes("%") || !RATE_CONTEXT.test(parentText) || CHANGE_CONTEXT.test(parentText)) continue;
    const next = raw.replace(/(-?\d+(?:\.\d+)?)%/g, (_m, v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return "0.0%";
      return `${Math.max(0, Math.min(100, n)).toFixed(String(v).includes(".") ? 1 : 0)}%`;
    });
    if (next !== raw) textNode.nodeValue = next;
  }
}

function removeNotificationOnlyParts(root: HTMLElement) {
  for (const small of root.querySelectorAll<HTMLElement>(".mia2-kpi small")) {
    if ((small.textContent || "").trim() === "コメントスキ") {
      small.closest<HTMLElement>(".mia2-kpi")?.style.setProperty("display", "none", "important");
    }
  }
  for (const h3 of root.querySelectorAll<HTMLElement>(".mia2-panel h3")) {
    if ((h3.textContent || "").includes("コメントへスキした人")) {
      h3.closest<HTMLElement>(".mia2-panel")?.style.setProperty("display", "none", "important");
    }
  }
}

export function MemberInsightAnalyticsBase({ revision = 0, onBack }: { revision?: number; onBack?: () => void }) {
  try { sessionStorage.setItem(SCOPE_KEY, "base"); } catch { /* storage may be unavailable */ }
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const apply = () => {
      removeNotificationOnlyParts(root);
      clampRenderedRates(root);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return <div className="miah-base-only" ref={ref}><MemberInsightAnalyticsFinal revision={revision} onBack={onBack} /></div>;
}
