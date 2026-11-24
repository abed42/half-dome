import type { SettingsMeta } from "./settings";
import { withSettingDefaultFlip } from "./settingDefaultFlip";

export const NEW_TAB_OPENS_DEFAULT_APPLIED = "newTabOpens:commandBarByDefault";
export const NEW_TAB_POSITION_DEFAULT_APPLIED = "newTabPosition:topByDefault";
export const NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED = "newTabButtonPosition:topByDefault";
export const COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED = "commandBarPlacement:centredByDefault";

const FLIPS = [
  { key: "newTabOpens", oldDefault: "page", applied: NEW_TAB_OPENS_DEFAULT_APPLIED },
  { key: "newTabPosition", oldDefault: "bottom", applied: NEW_TAB_POSITION_DEFAULT_APPLIED },
  { key: "newTabButtonPosition", oldDefault: "bottom", applied: NEW_TAB_BUTTON_POSITION_DEFAULT_APPLIED },
  { key: "commandBarPlacement", oldDefault: "field", applied: COMMAND_BAR_PLACEMENT_DEFAULT_APPLIED },
] as const;

export function withArcLayoutDefaults<S extends object>(saved: S | undefined, meta: SettingsMeta): { settings: S | undefined; settingsMeta: SettingsMeta } {
  let settings = saved;
  let settingsMeta = meta;
  for (const flip of FLIPS) {
    ({ settings, settingsMeta } = withSettingDefaultFlip(settings, settingsMeta, flip.key, flip.oldDefault, flip.applied));
  }
  return { settings, settingsMeta };
}
