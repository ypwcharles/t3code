import { transformSync, type PluginObj } from "@babel/core";
import * as t from "@babel/types";
import { describe, expect, it } from "vite-plus/test";
import { uiLocalizationPlugin, uiLocalizationVitePlugin, jsxDisplayText } from "../../vite/uiLocalization";

function compile(source: string, file = "components/Example.tsx") {
  return transformSync(source, {
    filename: `/repo/apps/web/src/${file}`,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [uiLocalizationPlugin],
  })!.code!;
}

describe("UI-only localization", () => {
  it("runs before the native React compiler while preserving JSX and TypeScript", async () => {
    const plugin = uiLocalizationVitePlugin();
    expect(plugin.enforce).toBe("pre");
    const hook = plugin.transform;
    const transform = typeof hook === "function" ? hook : hook!.handler;
    const result = await transform.call(
      {} as never,
      'const label: string = "Connected"; export function View(){return <button title="Settings">Save</button>}',
      "/repo/apps/web/src/components/Example.tsx",
      {} as never,
    );
    expect(result).toHaveProperty("code");
    const code = (result as { code: string }).code;
    expect(code).toContain('title={_uiText("Settings")}');
    expect(code).toContain('{_uiText("Save")}');
    expect(code).toContain('const label: string = "Connected"');
    expect(code).not.toContain("jsxDEV");
    expect(await transform.call({} as never, '<div>Save</div>', "/repo/apps/server/src/handler.tsx", {} as never)).toBeNull();
    expect(await transform.call({} as never, '<div>Save</div>', "/repo/apps/web/src/components/Example.test.tsx", {} as never)).toBeNull();
  });

  it("localizes JSX attributes before another compiler hoists their literals", () => {
    const result = transformSync('function View(){return <Section title="Text generation"/>}', {
      filename: "/repo/apps/web/src/components/Example.tsx",
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
      plugins: [
        uiLocalizationPlugin,
        (): PluginObj => ({
          visitor: {
            Program(path) {
              path.traverse({
                JSXAttribute(attribute) {
                  if (t.isStringLiteral(attribute.node.value)) {
                    const id = attribute.scope.generateUidIdentifier("label");
                    attribute.scope.push({ id, init: t.cloneNode(attribute.node.value) });
                    attribute.node.value = t.jsxExpressionContainer(id);
                  }
                },
              });
            },
          },
        }),
      ],
    });
    expect(result!.code).toContain('_uiText("Text generation")');
  });

  it("localizes JSX text, accessibility labels and display metadata", () => {
    const code = compile(
      'const items = [{id:"Settings", title:"Settings"}]; const view = <button aria-label="Settings">Save</button>;',
    );
    expect(code).toMatch(/title: _uiText\("Settings"\)/);
    expect(code).toMatch(/aria-label=\{_uiText\("Settings"\)\}/);
    expect(code).toContain('{_uiText("Save")}');
    expect(code).toContain('id: "Settings"');
  });

  it("does not translate protocol comparisons, command arguments, values or user content", () => {
    const code = compile(
      'const payload = {command:"Save",content:"Settings",path:"Settings"}; const view = <button value="Save" onClick={() => send("Save")}>{phase === "Connected" ? "Connected" : message}</button>;',
    );
    expect(code).toContain('phase === "Connected" ? _uiText("Connected") : message');
    expect(code).toContain('command: "Save"');
    expect(code).toContain('content: "Settings"');
    expect(code).toContain('path: "Settings"');
    expect(code).toContain('value="Save"');
    expect(code).toContain('send("Save")');
  });

  it("does not touch equality checks nested in a conditional or logical JSX expression", () => {
    const code = compile(
      'const view = <div>{state === "Save" && <span>Save</span>}{mode === "Plan" ? "Save" : "Cancel"}</div>;',
    );
    expect(code).toContain('state === "Save"');
    expect(code).toContain('mode === "Plan"');
    expect(code).not.toContain("=== _uiText");
  });

  it("keeps authored record titles and command payloads out of localization", () => {
    const code = compile(
      'const record={threadId:"123",title:"New thread"}; const command={command:"Save",label:"Save",description:"Settings"};',
    );
    expect(code).not.toContain("uiText");
  });

  it("leaves server code, tests, and unknown UI text unchanged", () => {
    expect(compile('const item={title:"Settings"};', "../../server/src/handler.ts")).not.toContain(
      "uiText",
    );
    expect(compile('const item={title:"Settings"};', "components/Example.test.tsx")).not.toContain(
      "uiText",
    );
    expect(compile("const view=<div>Unknown upstream label</div>;")).not.toContain("uiText");
  });

  it("preserves React whitespace at inline boundaries", () => {
    expect(jsxDisplayText("\n  Save\n  changes\n")).toBe("Save changes");
    expect(jsxDisplayText(" Save ")).toBe(" Save ");
    expect(compile("const view=<span> Save <b>{name}</b></span>;")).toContain('_uiText(" Save ")');
  });
});
