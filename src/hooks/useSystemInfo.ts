import { useEffect, useState } from "react";
import { getSystemInfo } from "../services/native";
import type { SystemInfo } from "../types";

export function useSystemInfo(intervalMs = 2500) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await getSystemInfo();
      if (alive && next) setInfo(next);
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return info;
}
