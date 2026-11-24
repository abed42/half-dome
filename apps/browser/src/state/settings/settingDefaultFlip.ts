import type { SettingsMeta } from "./settings";

export function withSettingDefaultFlip<S extends object>(
  saved: S | undefined,
  meta: SettingsMeta,
  key: string,
  oldDefault: unknown,
  applied: string,
): { settings: S | undefined; settingsMeta: SettingsMeta } {
  if (meta.inferred.includes(applied)) return { settings: saved, settingsMeta: meta };
  const marked = (m: SettingsMeta): SettingsMeta => ({ chosen: m.chosen, inferred: [...m.inferred, applied] });
  const untouched = !!saved && (saved as Record<string, unknown>)[key] === oldDefault && !(meta.chosen.includes(key) && !meta.inferred.includes(key));
  if (!untouched) return { settings: saved, settingsMeta: marked(meta) };
  const { [key]: _untouched, ...settings } = saved as Record<string, unknown>;
  const without = (keys: string[]) => keys.filter((k) => k !== key);
  return { settings: settings as S, settingsMeta: marked({ chosen: without(meta.chosen), inferred: without(meta.inferred) }) };
}
