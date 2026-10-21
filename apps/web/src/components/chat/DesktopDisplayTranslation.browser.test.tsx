import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { act, render } from "../../../test/render";
import type ChatMarkdown from "../ChatMarkdown";
import { DesktopDisplayTranslation, needsDisplayTranslation } from "./DesktopDisplayTranslation";
import { useDesktopTranslationSettings } from "../../hooks/useDesktopTranslationSettings";

const source = "The connection is ready. Your remote task can continue.";
const chinese = "连接已就绪。远程任务可以继续。";
const preferenceKey = "t3.desktop.displayTranslation.enabled";
const concurrencyKey = "t3.desktop.displayTranslation.maxConcurrency";
const Markdown = ({ text }: ComponentProps<typeof ChatMarkdown>) => <article>{text}</article>;

function PreferenceControls() {
  const { setEnabled, setMaxConcurrency } = useDesktopTranslationSettings();
  return (
    <aside>
      <button onClick={() => setEnabled(false)}>关闭自动翻译</button>
      <button onClick={() => setMaxConcurrency(4)}>并发 4 条</button>
    </aside>
  );
}

function View({ streaming = false, text = source, controls = false }) {
  return (
    <>
      {controls ? <PreferenceControls /> : null}
      <DesktopDisplayTranslation
        text={text}
        streaming={streaming}
        markdown={<Markdown text={text} cwd="/tmp/project" />}
        original={<article data-original>{text}</article>}
      />
    </>
  );
}

function setup() {
  const translate = vi.fn().mockResolvedValue(chinese);
  const cancel = vi.fn().mockResolvedValue(undefined);
  const previous = new Map(
    [preferenceKey, concurrencyKey].map((key) => [key, localStorage.getItem(key)]),
  );
  for (const key of previous.keys()) localStorage.removeItem(key);
  let notify: ((visible: boolean) => void) | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe() {
        notify?.(false);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal("desktopBridge", { displayTranslation: { translate, cancel } });
  return {
    translate,
    cancel,
    setVisible: (visible: boolean) => notify?.(visible),
    [Symbol.dispose]() {
      vi.unstubAllGlobals();
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    },
  };
}

function fakeTime() {
  vi.useFakeTimers();
  return { [Symbol.dispose]: () => vi.useRealTimers() };
}

async function advance() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}

describe("desktop translation display", () => {
  it("waits for streaming to finish and shows Chinese alongside the exact original text", async () => {
    using context = setup();
    await using screen = await render(<View streaming />);
    using _time = fakeTime();
    await act(() => context.setVisible(true));
    await advance();
    expect(context.translate).not.toHaveBeenCalled();
    expect(screen.container.querySelector("article")?.textContent).toBe(source);
    await screen.rerender(<View />);
    await advance();
    expect(context.translate).toHaveBeenCalledTimes(1);
    expect(screen.container.querySelector("[data-chinese-translation] article")?.textContent).toBe(
      chinese,
    );
    expect(screen.container.querySelector("article[data-original]")?.textContent).toBe(source);
    expect(screen.container.textContent).not.toMatch(/自动翻译：|收起译文|中文译文|复制译文/);
    expect(screen.container.querySelector('button[aria-label="复制译文"]')).not.toBeNull();
    expect(screen.container.querySelector('[role="status"]')).toBeNull();
    expect(context.translate.mock.calls[0]?.[0].maxConcurrency).toBe(3);
  });

  it("keeps original content on failure, supports retry and persists the disable preference", async () => {
    using context = setup();
    context.translate.mockRejectedValueOnce(new Error("offline"));
    await using screen = await render(<View controls />);
    using _time = fakeTime();
    await act(() => context.setVisible(true));
    await advance();
    expect(screen.container.querySelector("article[data-original]")?.textContent).toBe(source);
    expect(screen.container.querySelector('[role="status"]')?.textContent).toContain("翻译失败");
    await screen.getByRole("button", { name: /重试/ }).click();
    await advance();
    expect(screen.container.querySelector("[data-chinese-translation] article")?.textContent).toBe(
      chinese,
    );
    await screen.getByRole("button", { name: "关闭自动翻译" }).click();
    expect(localStorage.getItem(preferenceKey)).toBe("false");
    expect(screen.container.querySelector("article[data-original]")?.textContent).toBe(source);
    await screen.rerender(<View text="A completely new assistant message has arrived." />);
    await advance();
    expect(context.translate).toHaveBeenCalledTimes(2);
  });

  it("uses a concurrency preference shared with the settings controls", async () => {
    using context = setup();
    await using screen = await render(<View streaming controls />);
    using _time = fakeTime();
    await screen.getByRole("button", { name: "并发 4 条" }).click();
    await act(() => context.setVisible(true));
    await screen.rerender(<View />);
    await advance();
    expect(context.translate).toHaveBeenCalledWith(
      expect.objectContaining({ text: source, maxConcurrency: 4 }),
    );
    expect(localStorage.getItem(concurrencyKey)).toBe("4");
  });

  it("does not translate hidden messages, code-only output or messages on a web client", async () => {
    using context = setup();
    await using screen = await render(<View />);
    using _time = fakeTime();
    await advance();
    expect(context.translate).not.toHaveBeenCalled();
    expect(needsDisplayTranslation("```ts\nconst hello = 'world';\n```\n")).toBe(false);
    expect(needsDisplayTranslation("已经完成。运行 `npm test` 即可。")).toBe(false);
    delete window.desktopBridge;
    await screen.rerender(<View text="A new assistant reply on a web client." />);
    await advance();
    expect(context.translate).not.toHaveBeenCalled();
    expect(screen.container.querySelector("article[data-original]")?.textContent).toBe(
      "A new assistant reply on a web client.",
    );
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("ignores late results for an older source and cancels its request", async () => {
    using context = setup();
    let release!: (text: string) => void;
    context.translate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    await using screen = await render(<View />);
    using _time = fakeTime();
    await act(() => context.setVisible(true));
    await advance();
    const next = "The second assistant message is still being streamed.";
    await screen.rerender(<View streaming text={next} />);
    await act(() => {
      release(chinese);
    });
    expect(screen.container.querySelector("article[data-original]")?.textContent).toBe(next);
    expect(screen.container.querySelector("[data-chinese-translation]")).toBeNull();
    expect(context.cancel).toHaveBeenCalled();
  });
});
