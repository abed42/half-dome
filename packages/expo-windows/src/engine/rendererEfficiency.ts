import type { RendererEfficiencyCounts, RendererEfficiencyNative } from "@ardia/shell";
import { engineAvailable, hostCall } from "./host";

const REFRESH_MS = 10 * 60_000;
const KEYS = ["throttled", "restored", "failed", "exemptCall", "exemptCapture", "exemptPictureInPicture", "exemptAudio"] as const;

type Reply = { counts?: unknown } | null | undefined;
type Ask = (epoch: string) => Promise<Reply>;

const zero = (): RendererEfficiencyCounts => ({ throttled: 0, restored: 0, failed: 0, exemptCall: 0, exemptCapture: 0, exemptPictureInPicture: 0, exemptAudio: 0 });
const counted = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0);

export function rendererEfficiencyCounts(ask: Ask, available: () => boolean, every = REFRESH_MS) {
  let held: Record<string, RendererEfficiencyCounts> = {};
  let epoch = "";
  let generation = 0;
  let refreshing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function request(): Promise<void> {
    const askedIn = generation;
    const askedFor = epoch;
    return ask(askedFor)
      .then((reply) => {
        if (askedIn !== generation || !askedFor) return;
        const counts = reply?.counts;
        const fields = typeof counts === "object" && counts !== null ? (counts as Record<string, unknown>) : {};
        if (!KEYS.some((key) => counted(fields[key]))) return;
        const into = (held[askedFor] ??= zero());
        for (const key of KEYS) into[key] += counted(fields[key]);
      })
      .catch(() => undefined);
  }

  function refresh(): Promise<void> {
    if (!available()) return Promise.resolve();
    refreshing ??= request().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  const counts: RendererEfficiencyNative & { refresh(): Promise<void>; stop(): void } = {
    takeCounts() {
      if (!timer && available()) timer = setInterval(() => void refresh(), every);
      const taken = held;
      held = {};
      void refresh();
      return taken;
    },
    setConsentEpoch(next) {
      if (next === epoch) return;
      epoch = next;
      generation += 1;
      held = {};
      if (available()) void ask(next).catch(() => undefined);
    },
    refresh,
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
  return counts;
}

export const windowsRendererEfficiency = rendererEfficiencyCounts((epoch) => hostCall<Reply>("renderer.efficiencyCounts", { epoch }), engineAvailable);
