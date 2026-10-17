// @effect-diagnostics nodeBuiltinImport:off -- Local display translation uses the Electron and Node runtime boundary.
import { app, ipcMain } from "electron";
import * as NodePath from "node:path";
import { TranslationQueue, runCodexTranslation } from "./codexTranslation.ts";

export function installDesktopDisplayTranslation() {
  let queue: TranslationQueue | undefined;
  const service = () => {
    queue ??= new TranslationQueue({
      cachePath: NodePath.join(app.getPath("userData"), "display-translation", "cache.json"),
      runner: (text, signal) =>
        runCodexTranslation(text, signal, {
          workRoot: NodePath.join(app.getPath("temp"), "t3-display-translation"),
        }),
    });
    return queue;
  };
  const request = (event: Electron.IpcMainInvokeEvent, value: unknown) => {
    if (
      !event.senderFrame?.url.startsWith("t3code://app/") ||
      typeof value !== "object" ||
      value === null ||
      !("requestId" in value) ||
      typeof value.requestId !== "string" ||
      !/^[\w-]{1,100}$/.test(value.requestId)
    ) {
      throw new Error("无效的桌面翻译请求");
    }
    return String(event.sender.id) + ":" + value.requestId;
  };
  ipcMain.handle("desktop:display-translation", (event, value: unknown) => {
    const id = request(event, value);
    if (
      typeof value !== "object" ||
      value === null ||
      !("text" in value) ||
      typeof value.text !== "string"
    ) {
      throw new Error("无效的翻译内容");
    }
    const translator = service();
    if ("maxConcurrency" in value) {
      if (typeof value.maxConcurrency !== "number") throw new Error("无效的翻译并发数");
      translator.setConcurrency(value.maxConcurrency);
    }
    return translator.translate(id, value.text);
  });
  ipcMain.handle("desktop:display-translation-cancel", (event, value: unknown) => {
    service().cancel(request(event, value));
  });
  app.on("web-contents-created", (_event, contents) => {
    const owner = String(contents.id) + ":";
    contents.once("destroyed", () => queue?.cancelOwner(owner));
  });
  app.on("before-quit", () => queue?.cancelOwner(""));
}
