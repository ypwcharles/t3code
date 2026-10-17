import { describe, expect, it } from "vite-plus/test";
import {
  readUiLanguage,
  translateUiText,
  uiSearchAliases,
  UI_LANGUAGE_STORAGE_KEY,
} from "./uiLocale";
import { ZH_CN } from "./zh-CN";

describe("UI language", () => {
  it("defaults to Chinese and honors the saved English preference", () => {
    expect(readUiLanguage(null)).toBe("zh-CN");
    expect(
      readUiLanguage({ getItem: (key) => (key === UI_LANGUAGE_STORAGE_KEY ? "en-US" : null) }),
    ).toBe("en-US");
    expect(readUiLanguage({ getItem: () => "invalid" })).toBe("zh-CN");
    expect(
      readUiLanguage({
        getItem() {
          throw new Error("blocked");
        },
      }),
    ).toBe("zh-CN");
  });

  it("keeps whitespace, unknown text, commands and English content intact", () => {
    expect(translateUiText(" Settings ", "zh-CN")).toBe(" 设置 ");
    expect(translateUiText("Settings", "en-US")).toBe("Settings");
    expect(translateUiText("constructor", "zh-CN")).toBe("constructor");
    const source = "User content: Settings /opt/project `git status` https://example.com";
    expect(translateUiText(source, "zh-CN")).toBe(source);
    expect(translateUiText("An upstream label added tomorrow", "zh-CN")).toBe(
      "An upstream label added tomorrow",
    );
  });

  it("makes settings searchable in both languages", () => {
    expect(uiSearchAliases("Connections")).toContain("连接");
    expect(uiSearchAliases("连接")).toContain("Connections");
    expect(uiSearchAliases("Unknown setting")).toEqual([]);
  });

  it("keeps literal inline commands in translated help", () => {
    for (const [source, translation] of Object.entries(ZH_CN)) {
      expect(translation.trim().length, source).toBeGreaterThan(0);
      const commands = source.match(/`[^`]+`/g) ?? [];
      for (const command of commands) expect(translation, source).toContain(command);
    }
  });
});
