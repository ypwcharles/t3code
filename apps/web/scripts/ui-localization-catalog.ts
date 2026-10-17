import { transformSync } from "@babel/core";
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { uiLocalizationPlugin } from "../vite/uiLocalization.ts";
import { ZH_CN } from "../src/i18n/zh-CN.ts";

const root = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const files = NodeChildProcess.execFileSync("git", ["ls-files", "-z", "--", "src"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\./.test(file));
const messages = new Map<string, Set<string>>();
for (const file of files) {
  transformSync(NodeFS.readFileSync(NodePath.resolve(root, file), "utf8"), {
    filename: NodePath.resolve(root, file),
    configFile: false,
    babelrc: false,
    code: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [
      [
        uiLocalizationPlugin,
        {
          onMessage(message: string) {
            const paths = messages.get(message) ?? new Set();
            paths.add(file);
            messages.set(message, paths);
          },
        },
      ],
    ],
  });
}
const entries = [...messages].map(([text, paths]) => ({
  text,
  translated: Object.hasOwn(ZH_CN, text),
  files: [...paths],
}));
console.log(
  JSON.stringify(
    {
      messages: entries.length,
      translated: entries.filter((entry) => entry.translated).length,
      filesWithTranslations: new Set(
        entries.filter((entry) => entry.translated).flatMap((entry) => entry.files),
      ).size,
      entries,
    },
    null,
    2,
  ),
);
