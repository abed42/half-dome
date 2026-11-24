import type { SettingsMeta } from "./settings";

const KEY = "addressBar";
const OLD_DEFAULT = "toolbar";
export const ADDRESS_BAR_DEFAULT_APPLIED = "addressBar:sidebarByDefault";

export function withAddressBarOnLeft<S extends object>(saved: S | undefined, meta: SettingsMeta): { settings: S | undefined; settingsMeta: SettingsMeta } {
  if (meta.inferred.includes(ADDRESS_BAR_DEFAULT_APPLIED)) return { settings: saved, settingsMeta: meta };
  const marked = (m: SettingsMeta): SettingsMeta => ({ chosen: m.chosen, inferred: [...m.inferred, ADDRESS_BAR_DEFAULT_APPLIED] });
  const untouchedToolbar = !!saved && (saved as Record<string, unknown>)[KEY] === OLD_DEFAULT && !(meta.chosen.includes(KEY) && !meta.inferred.includes(KEY));
  if (!untouchedToolbar) return { settings: saved, settingsMeta: marked(meta) };
  const { [KEY]: _untouched, ...settings } = saved as Record<string, unknown>;
  const without = (keys: string[]) => keys.filter((k) => k !== KEY);
  return { settings: settings as S, settingsMeta: marked({ chosen: without(meta.chosen), inferred: without(meta.inferred) }) };
}
