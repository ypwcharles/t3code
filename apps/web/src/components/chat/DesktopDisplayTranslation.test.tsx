// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type ChatMarkdown from "../ChatMarkdown";
import { DesktopDisplayTranslation, needsDisplayTranslation } from "./DesktopDisplayTranslation";
import { useDesktopTranslationSettings } from "../../hooks/useDesktopTranslationSettings";

const source = "The connection is ready. Your remote task can continue.";
const chinese = "连接已就绪。远程任务可以继续。";
const preferenceKey = "t3.desktop.displayTranslation.enabled";
const Markdown = ({ text }: ComponentProps<typeof ChatMarkdown>) => <article>{text}</article>;
let root: Root;
let container: HTMLDivElement;
let visibility: (entries: { isIntersecting: boolean }[]) => void;
const translate = vi.fn();
const cancel = vi.fn().mockResolvedValue(undefined);

function PreferenceControls() {
  const { setEnabled, setMaxConcurrency } = useDesktopTranslationSettings();
  return (
    <aside>
      <button onClick={() => setEnabled(false)}>关闭自动翻译</button>
      <button onClick={() => setMaxConcurrency(4)}>并发 4 条</button>
    </aside>
  );
}

async function render(streaming = false, text = source, controls = false) {
  await act(async () => {
    root.render(
      <>
        {controls ? <PreferenceControls /> : null}
        <DesktopDisplayTranslation
          text={text}
          streaming={streaming}
          markdown={<Markdown text={text} cwd="/tmp/project" />}
          original={<article data-original>{text}</article>}
        />
      </>,
    );
  });
}
async function advance() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent === text,
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof visibility) {
        visibility = callback;
      }
      observe() {
        visibility([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  window.localStorage.clear();
  translate.mockReset().mockResolvedValue(chinese);
  cancel.mockClear();
  Object.defineProperty(window, "desktopBridge", {
    configurable: true,
    value: { displayTranslation: { translate, cancel } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("desktop translation display", () => {
  it("waits for streaming to finish and shows Chinese alongside the exact original text", async () => {
    await render(true);
    await advance();
    expect(translate).not.toHaveBeenCalled();
    expect(container.querySelector("article")?.textContent).toBe(source);
    await render(false);
    await advance();
    expect(translate).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-chinese-translation] article")?.textContent).toBe(
      chinese,
    );
    expect(container.querySelector("article[data-original]")?.textContent).toBe(source);
    expect(container.textContent).not.toMatch(/自动翻译：|收起译文|中文译文|复制译文/);
    expect(container.querySelector('button[aria-label="复制译文"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(translate.mock.calls[0]?.[0].maxConcurrency).toBe(3);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("keeps original content on failure, supports retry and persists the disable preference", async () => {
    translate.mockRejectedValueOnce(new Error("offline"));
    await render(false, source, true);
    await advance();
    expect(container.querySelector("article[data-original]")?.textContent).toBe(source);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("翻译失败");
    await click("重试");
    await advance();
    expect(container.querySelector("[data-chinese-translation] article")?.textContent).toBe(
      chinese,
    );
    await click("关闭自动翻译");
    expect(window.localStorage.getItem(preferenceKey)).toBe("false");
    expect(container.querySelector("article[data-original]")?.textContent).toBe(source);
    await render(false, "A completely new assistant message has arrived.");
    await advance();
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("uses a concurrency preference shared with the settings controls", async () => {
    await render(true, source, true);
    await click("并发 4 条");
    await render(false, source, true);
    await advance();
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({ text: source, maxConcurrency: 4 }),
    );
    expect(window.localStorage.getItem("t3.desktop.displayTranslation.maxConcurrency")).toBe("4");
  });

  it("does not translate hidden messages, code-only output or messages on a web client", async () => {
    await render();
    await act(async () => {
      visibility([{ isIntersecting: false }]);
    });
    await advance();
    expect(translate).not.toHaveBeenCalled();
    expect(needsDisplayTranslation("```ts\nconst hello = 'world';\n```\n")).toBe(false);
    expect(needsDisplayTranslation("已经完成。运行 `npm test` 即可。")).toBe(false);
    delete window.desktopBridge;
    await render();
    await advance();
    expect(translate).not.toHaveBeenCalled();
    expect(container.querySelector("article[data-original]")?.textContent).toBe(source);
    expect(container.querySelector("button")).toBeNull();
  });

  it("ignores late results for an older source and cancels its request", async () => {
    let release!: (text: string) => void;
    translate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    await render();
    await advance();
    const next = "The second assistant message is still being streamed.";
    await render(true, next);
    await act(async () => {
      release(chinese);
    });
    expect(container.querySelector("article[data-original]")?.textContent).toBe(next);
    expect(cancel).toHaveBeenCalled();
  });
});
