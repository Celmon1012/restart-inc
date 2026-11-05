import { useEffect } from "react";

/**
 * Fades `.sol-reveal` elements in as they scroll into view. The hidden
 * starting state is only applied once the page has opted in (`sol-js` on
 * <html>), so everything stays visible if scripts fail or motion is reduced.
 * Pass deps that change the set of revealable elements (e.g. a filter) so the
 * new ones get observed too.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      document.querySelectorAll<HTMLElement>(".sol-reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    document.documentElement.classList.add("sol-js");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll<HTMLElement>(".sol-reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => document.documentElement.classList.remove("sol-js"), []);
}
