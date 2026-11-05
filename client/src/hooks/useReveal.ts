import { useEffect } from "react";

/**
 * Fades `.sol-reveal` elements in as they scroll into view. The hidden
 * starting state is only applied once this hook has run (`sol-js` on <html>),
 * so the page stays fully visible if scripts fail or motion is reduced.
 */
export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".sol-reveal"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
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
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.documentElement.classList.remove("sol-js");
    };
  }, []);
}
