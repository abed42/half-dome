import { create } from "zustand";
import { readDocument, writeDocument } from "../../platform/documents";
import { parseSaved, unchanged, versionedJson, type Migrations } from "../../lib/savedDocument";
import { onboardingCompletedAt } from "../onboarding/onboardingDocument";
import { useTour } from "../onboarding/tour";
import { noteSpacesTip } from "../telemetry/usage";
import type { ConsentToken } from "../telemetry/usageClient";

const DOC = "spaces-tip.json";
const DOC_VERSION = 1;
const DOC_MIGRATIONS: Migrations = { 0: unchanged };

type Saved = { dismissedAt: number | null };

type TipState = { dismissedAt: number | null; shown: boolean };

function readSaved(): Saved {
  try {
    const doc = parseSaved(readDocument(DOC), DOC_VERSION, DOC_MIGRATIONS) as { dismissedAt?: unknown } | null;
    const dismissedAt = typeof doc?.dismissedAt === "number" && Number.isFinite(doc.dismissedAt) ? doc.dismissedAt : null;
    return { dismissedAt };
  } catch {
    return { dismissedAt: null };
  }
}

function writeSaved(saved: Saved) {
  try {
    writeDocument(DOC, versionedJson(saved, DOC_VERSION));
  } catch {}
}

const initial = readSaved();

export const useSpacesTip = create<TipState>()(() => ({ dismissedAt: initial.dismissedAt, shown: false }));

export type SpacesTipVisibility = {
  dismissed: boolean;
  onboardingDone: boolean;
  switcherShown: boolean;
  tourActive: boolean;
};

export const spacesTipDue = ({ dismissed, onboardingDone, switcherShown, tourActive }: SpacesTipVisibility) =>
  !dismissed && onboardingDone && switcherShown && !tourActive;

export function markSpacesTipShown(consent: ConsentToken | null) {
  if (useSpacesTip.getState().shown) return;
  useSpacesTip.setState({ shown: true });
  noteSpacesTip("shown", consent);
}

export function dismissSpacesTip(via: "gotIt" | "menu", consent: ConsentToken | null) {
  if (useSpacesTip.getState().dismissedAt !== null) return;
  const dismissedAt = Date.now();
  writeSaved({ dismissedAt });
  useSpacesTip.setState({ dismissedAt });
  noteSpacesTip(via === "menu" ? "menu" : "dismissed", consent);
}

export function spacesTipOnboardingDone() {
  return onboardingCompletedAt() !== null;
}

export function spacesTipTourActive(windowId: string) {
  const tour = useTour.getState();
  return tour.windowId === windowId && tour.stops.length > 0;
}

export const forgetSpacesTipForTests = () => {
  writeSaved({ dismissedAt: null });
  useSpacesTip.setState({ dismissedAt: null, shown: false });
};
