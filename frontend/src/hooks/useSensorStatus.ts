"use client";

import { useEffect, useState } from "react";
import type { HardwareStatus, SensorReading, ServiceState } from "@/lib/types";
import { api } from "@/lib/api";

/**
 * Polls the latest sensor reading + hardware status for the hardware page
 * and the status pills. Refreshes every 2 seconds.
 */
export function useSensorStatus(pollMs = 2000) {
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [hw, setHw] = useState<HardwareStatus | null>(null);
  const [backend, setBackend] = useState<ServiceState>("offline");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [health, reading, hardware] = await Promise.all([
          api.health().catch(() => null),
          api.sensorLatest().catch(() => null),
          api.hardwareStatus().catch(() => null),
        ]);
        if (cancelled) return;
        setBackend(health ? "online" : "offline");
        if (reading) setLatest(reading);
        if (hardware) setHw(hardware);
        setLoading(false);
      } catch {
        if (!cancelled) setBackend("offline");
      }
    }

    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { latest, hw, backend, loading };
}
