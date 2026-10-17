import { useDesktopTranslationSettings } from "../../hooks/useDesktopTranslationSettings";
import { Switch } from "../ui/switch";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function DesktopTranslationSettings() {
  const { enabled, setEnabled, maxConcurrency, setMaxConcurrency } =
    useDesktopTranslationSettings();
  if (!window.desktopBridge?.displayTranslation) return null;
  return (
    <SettingsSection id="desktop-translation" title="自动翻译">
      <SettingsRow
        {...searchableSetting("desktop-translation-enabled")}
        description="在英文回复下方显示中文。使用本机 Codex 登录，不影响远端 Claude 的对话。"
        control={<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="自动翻译" />}
      />
      <SettingsRow
        {...searchableSetting("desktop-translation-concurrency")}
        description="同时翻译的消息数量，默认 3 条。已翻译的内容会缓存在本机。"
        control={
          <Select
            value={maxConcurrency}
            onValueChange={(value) => {
              if (value === 1 || value === 2 || value === 3 || value === 4)
                setMaxConcurrency(value);
            }}
          >
            <SelectTrigger size="sm" className="w-auto min-w-0" aria-label="翻译并发数">
              <SelectValue>{maxConcurrency} 条</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {([1, 2, 3, 4] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {value} 条
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
      <SettingsRow
        {...searchableSetting("desktop-translation-model")}
        description="固定使用 GPT-6-Luna，低推理强度；保留代码、链接和路径。"
        control={<span className="font-mono text-sm text-muted-foreground">gpt-6-luna</span>}
      />
    </SettingsSection>
  );
}
