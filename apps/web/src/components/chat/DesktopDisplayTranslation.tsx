// @effect-diagnostics cryptoRandomUUID:off -- Renderer IPC request identifiers use the browser crypto API.
import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ComponentProps,
} from "react";
import { CopyIcon, LoaderCircleIcon } from "lucide-react";
import { useDesktopTranslationSettings } from "../../hooks/useDesktopTranslationSettings";
import type ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";

export function needsDisplayTranslation(text: string) {
  const prose = text
    .replace(/^ {0,3}(\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?:\n|$)/gm, "")
    .replace(/\x60[^\x60]*\x60|https?:\/\/\S+/g, "");
  const latin = prose.match(/[A-Za-z]/g)?.length ?? 0;
  const chinese = prose.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latin >= 12 && latin > chinese * 1.5;
}

export function DesktopDisplayTranslation({
  text,
  streaming,
  original,
  markdown,
}: {
  text: string;
  streaming: boolean;
  original: ReactNode;
  markdown: ReactElement<ComponentProps<typeof ChatMarkdown>>;
}) {
  const bridge = window.desktopBridge?.displayTranslation;
  const { enabled, maxConcurrency } = useDesktopTranslationSettings();
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{ source: string; translation: string } | null>(null);
  const [status, setStatus] = useState<{
    source: string;
    retry: number;
    pending: boolean;
    error: string | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const eligible = needsDisplayTranslation(text);
  const translation = result?.source === text ? result.translation : null;
  const activeStatus =
    enabled &&
    !streaming &&
    visible &&
    eligible &&
    status?.source === text &&
    status.retry === retry
      ? status
      : null;
  const error = activeStatus?.error ?? null;
  const pending = activeStatus?.pending === true;

  useEffect(() => {
    if (!bridge || !container.current) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "100px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [bridge]);

  useEffect(() => {
    if (!bridge || !enabled || !visible || streaming || !eligible) return;
    let active = true;
    const requestId = crypto.randomUUID();
    // One completed message per request; never translate each streaming token.
    const timer = setTimeout(() => {
      setStatus({ source: text, retry, pending: true, error: null });
      bridge.translate({ requestId, text, maxConcurrency }).then(
        (value) => {
          if (active) {
            setResult({ source: text, translation: value });
            setStatus({ source: text, retry, pending: false, error: null });
          }
        },
        (cause: unknown) => {
          if (active) {
            setStatus({
              source: text,
              retry,
              pending: false,
              error: cause instanceof Error ? cause.message : "翻译失败，已保留原文",
            });
          }
        },
      );
    }, 100);
    return () => {
      active = false;
      clearTimeout(timer);
      void bridge.cancel({ requestId }).catch(() => {});
    };
  }, [bridge, enabled, maxConcurrency, visible, streaming, eligible, text, retry]);

  if (!bridge) return original;
  const translated = enabled && !streaming && translation !== null;
  return (
    <div ref={container} data-display-translation="true">
      {original}
      {enabled && (pending || error) ? (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground" role="status">
          {pending ? (
            <LoaderCircleIcon className="size-3 animate-spin" aria-label="翻译中" />
          ) : (
            "翻译失败，原文已保留"
          )}
          {error ? (
            <Button
              size="micro"
              variant="ghost-muted"
              aria-label={error + "，重试"}
              onClick={() => setRetry(retry + 1)}
            >
              重试
            </Button>
          ) : null}
        </div>
      ) : null}
      {/* The original always remains intact; the translation has no provider/citation context. */}
      {translated ? (
        <div
          className="group/translation relative mt-4 border-l-2 border-border pl-3 pr-7"
          lang="zh-CN"
          data-chinese-translation
        >
          <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover/translation:opacity-100 group-focus-within/translation:opacity-100">
            <Button
              size="icon-micro"
              variant="ghost-muted"
              aria-label="复制译文"
              title="复制译文"
              onClick={() => {
                void navigator.clipboard
                  .writeText(translation)
                  .catch(() =>
                    setStatus({ source: text, retry, pending: false, error: "复制失败" }),
                  );
              }}
            >
              <CopyIcon aria-hidden="true" />
            </Button>
          </div>
          {cloneElement(markdown, { text: translation, isStreaming: false })}
        </div>
      ) : null}
    </div>
  );
}
