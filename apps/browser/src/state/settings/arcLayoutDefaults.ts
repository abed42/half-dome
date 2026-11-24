import type { SettingsMeta } from "./settings";
import { withSettingDefaultFlip } from "./settingDefaultFlip";

export const NEW_TAB_OPENS_DEFAULT_APPLIED = "newTabOpens:commandBarByDefault";
export const NEW_TAB_POSITION_DEFAULT_APPLIED = "newTabPosition:topByDefault";
export const NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED = "newTabButtonPosition:topByDefault";
export const COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED = "commandBarPlacement:centredByDefault";

const FLIPS = [
  { key: "newTabPosition", oldDefault: "bottom", applied: NEW_TAB_POSITION_DEFAULT_APPLIED },
  { key: "newTabButtonPosition", oldDefault: "bottom", applied: NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED },
  { key: "commandBarPlacement", oldDefault: "field", applied: COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED },
] as const;

const NEW_TAB_OPENS = "newTabOpens";

export function withArcLayoutDefaults<S extends object>(saved: S | undefined, meta: SettingsMeta): { settings: S | undefined; settingsMeta: SettingsMeta } {
  let settings = saved;
  let settingsMeta = meta;
  for (const flip of FLIPS) {
    ({ settings, settingsMeta } = withSettingDefaultFlip(settings, settingsMeta, flip.key, flip.oldDefault, flip.applied));
  }
  return restoreNewTabPage(settings, settingsMeta);
}

function restoreNewTabPage<S extends object>(saved: S | undefined, meta: SettingsMeta): { settings: S | undefined; settingsMeta: SettingsMeta } {
  if (!meta.inferred.includes(NEW_TAB_OPENS_DEFAULT_APPLIED)) return { settings: saved, settingsMeta: meta };
  const explicit = meta.chosen.includes(NEW_TAB_OPENS) && !meta.inferred.includes(NEW_TAB_OPENS);
  if (explicit || !saved || (saved as Record<string, unknown>)[NEW_TAB_OPENS] !== "commandBar") return { settings: saved, settingsMeta: meta };
  const { [NEW_TAB_OPENS]: _opened, ...settings } = saved as Record<string, unknown>;
  const without = (keys: string[]) => keys.filter((key) => key !== NEW_TAB_OPENS);
  return { settings: settings as S, settingsMeta: { chosen: without(meta.chosen), inferred: without(meta.inferred) } };
}
