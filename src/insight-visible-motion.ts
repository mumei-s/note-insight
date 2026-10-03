import { useEffect, useRef, useState } from "react";

/** Run presentation only while the scene is visible; never delay navigation or data. */
export function useVisibleMotion<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null), [visible, setVisible] = useState(false), [reduced, setReduced] = useState(false), [foreground, setForeground] = useState(true);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)"), update = () => setReduced(Boolean(media?.matches)), page = () => setForeground(document.visibilityState !== "hidden");
    update(); page(); media?.addEventListener?.("change", update); document.addEventListener("visibilitychange", page);
    const node = ref.current;
    let observer: IntersectionObserver | undefined;
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { threshold: .08 }); observer.observe(node);
    } else setVisible(true);
    return () => { observer?.disconnect(); media?.removeEventListener?.("change", update); document.removeEventListener("visibilitychange", page); };
  }, []);
  return { ref, motion: visible && foreground && !reduced, reduced, visible, foreground };
}
