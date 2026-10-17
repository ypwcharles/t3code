import { useState } from "react";
import { getUiLanguage, saveUiLanguage, type UiLanguage } from "../../i18n/uiLocale";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow, SettingsSection } from "./settingsLayout";

export function UiLanguageSettings() {
  const current = getUiLanguage();
  const [selected, setSelected] = useState<UiLanguage>(current);
  const [failed, setFailed] = useState(false);
  const chinese = current === "zh-CN";
  return (
    <SettingsSection id="ui-language" title={chinese ? "界面语言" : "Interface language"}>
      <SettingsRow
        id="ui-language-setting"
        title={chinese ? "界面语言" : "Interface language"}
        description={
          chinese
            ? "仅改变界面文字。切换后重新载入，不改变会话内容。"
            : "Changes interface text only. Reloads the client without changing conversation content."
        }
        control={
          <div className="flex items-center gap-2">
            <Select
              value={selected}
              onValueChange={(value) => {
                if (value === "zh-CN" || value === "en-US") setSelected(value);
              }}
            >
              <SelectTrigger aria-label={chinese ? "界面语言" : "Interface language"}>
                <SelectValue>{selected === "zh-CN" ? "简体中文" : "English"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
              </SelectPopup>
            </Select>
            {selected !== current && (
              <Button
                size="sm"
                onClick={() => {
                  if (saveUiLanguage(selected)) window.location.reload();
                  else setFailed(true);
                }}
              >
                {chinese ? "应用并重新载入" : "Apply and reload"}
              </Button>
            )}
          </div>
        }
      />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {chinese
            ? "无法保存语言设置，请检查本机存储权限。"
            : "Could not save the language preference. Check local storage permissions."}
        </p>
      )}
    </SettingsSection>
  );
}
