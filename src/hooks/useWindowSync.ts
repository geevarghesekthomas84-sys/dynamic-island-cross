import { useEffect, useRef } from "react";
import { setWindowSize } from "../services/native";

/**
 * Keeps the native window in step with the island. Growing is immediate so the island is never
 * clipped mid-animation; shrinking waits for the spring to settle.
 */
export function useWindowSync(width: number, height: number, settleMs = 420) {
  const current = useRef({ width: 0, height: 0 });
  useEffect(() => {
    const cur = current.current;
    const grown = { width: Math.max(cur.width, width), height: Math.max(cur.height, height) };
    if (grown.width !== cur.width || grown.height !== cur.height) {
      current.current = grown;
      void setWindowSize(grown.width, grown.height);
    }
    const t = setTimeout(() => {
      current.current = { width, height };
      void setWindowSize(width, height);
    }, settleMs);
    return () => clearTimeout(t);
  }, [width, height, settleMs]);
}
