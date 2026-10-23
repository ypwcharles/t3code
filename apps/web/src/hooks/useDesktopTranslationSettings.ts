import * as Schema from "effect/Schema";
import { useLocalStorage } from "./useLocalStorage";

// Keep the original switch key so existing preferences survive this update.
const DESKTOP_TRANSLATION_ENABLED_KEY = "t3.desktop.displayTranslation.enabled";
const DESKTOP_TRANSLATION_CONCURRENCY_KEY = "t3.desktop.displayTranslation.maxConcurrency";
const Concurrency = Schema.Literals([1, 2, 3, 4]);

export function useDesktopTranslationSettings() {
  const [enabled, setEnabled] = useLocalStorage(
    DESKTOP_TRANSLATION_ENABLED_KEY,
    true,
    Schema.Boolean,
  );
  const [maxConcurrency, setMaxConcurrency] = useLocalStorage(
    DESKTOP_TRANSLATION_CONCURRENCY_KEY,
    3,
    Concurrency,
  );
  return { enabled, setEnabled, maxConcurrency, setMaxConcurrency };
}
