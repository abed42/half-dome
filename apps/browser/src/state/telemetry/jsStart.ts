export const jsStartedAt = Date.now();

let firstRenderAt: number | undefined;

export function launchRendering() {
  firstRenderAt ??= Date.now();
}

export function firstCommitMs(commitAt: number | undefined): number | null {
  if (firstRenderAt === undefined || commitAt === undefined) return null;
  const took = commitAt - firstRenderAt;
  return took >= 0 && took < 60_000 ? Math.round(took) : null;
}
