import { ZH_CN } from "./zh-CN";

export type UiLanguage = "zh-CN" | "en-US";
export const UI_LANGUAGE_STORAGE_KEY = "t3code:ui-language";

export function readUiLanguage(storage?: Pick<Storage, "getItem"> | null): UiLanguage {
  try {
    const value = (storage === undefined ? window.localStorage : storage)?.getItem(
      UI_LANGUAGE_STORAGE_KEY,
    );
    return value === "en-US" ? "en-US" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

// Module-level labels and render-time labels use the same language. Changing
// it deliberately reloads the client so cached option/search metadata agrees.
const language = typeof window === "undefined" ? "en-US" : readUiLanguage();
export const getUiLanguage = (): UiLanguage => language;

export function translateUiText(source: string, locale: UiLanguage): string {
  if (locale === "en-US") return source;
  const core = source.trim();
  const translated = Object.hasOwn(ZH_CN, core) ? ZH_CN[core] : undefined;
  if (!translated) return source;
  const start = source.indexOf(core);
  return source.slice(0, start) + translated + source.slice(start + core.length);
}

export function uiText(source: string, ...values: ReadonlyArray<unknown>): string {
  return translateUiText(source, language).replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  );
}

const englishAliases = new Map<string, string[]>();
for (const [english, chinese] of Object.entries(ZH_CN)) {
  const aliases = englishAliases.get(chinese) ?? [];
  aliases.push(english);
  englishAliases.set(chinese, aliases);
}

export function uiSearchAliases(label: string): ReadonlyArray<string> {
  return [
    ...(Object.hasOwn(ZH_CN, label) ? [ZH_CN[label]!] : []),
    ...(englishAliases.get(label) ?? []),
  ];
}

export function initializeUiLanguage(): void {
  document.documentElement.lang = language;
}

export function saveUiLanguage(value: UiLanguage): boolean {
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}
