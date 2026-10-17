import type { PluginObj, PluginPass } from "@babel/core";
import * as t from "@babel/types";
import { ZH_CN } from "../src/i18n/zh-CN.ts";

interface UiPass extends PluginPass {
  enabled?: boolean;
  used?: boolean;
  uiId?: t.Identifier;
  opts: { onMessage?: (message: string) => void };
}

const DISPLAY_FIELDS = new Set([
  "label",
  "title",
  "description",
  "placeholder",
  "aria-label",
  "aria-description",
  "alt",
  "emptyText",
  "searchPlaceholder",
  "tooltip",
  "confirmLabel",
  "cancelLabel",
  "loadingText",
  "emptyMessage",
  "errorMessage",
  "successMessage",
  "detail",
]);

const RECORD_FIELDS = new Set([
  "threadId",
  "projectId",
  "environmentId",
  "worktreePath",
  "command",
  "payload",
  "content",
]);

// React's JSX text whitespace rules: indentation disappears, but inline
// spaces and spaces between nonempty lines remain meaningful.
export function jsxDisplayText(value: string): string {
  const lines = value.replace(/\t/g, " ").split(/\r\n|\n|\r/);
  const last = lines.findLastIndex((line) => /[^ ]/.test(line));
  return lines
    .map((line, i) => {
      let text = i === 0 ? line : line.replace(/^ +/, "");
      if (i !== lines.length - 1) text = text.replace(/ +$/, "");
      return text ? text + (i < last ? " " : "") : "";
    })
    .join("");
}

export function uiLocalizationPlugin(): PluginObj<UiPass> {
  const translate = (source: string, state: UiPass) => {
    if (!/[A-Za-z]/.test(source)) return null;
    state.opts.onMessage?.(source.trim());
    if (!Object.hasOwn(ZH_CN, source.trim())) return null;
    state.used = true;
    return t.callExpression(t.cloneNode(state.uiId!), [t.stringLiteral(source)]);
  };
  // Run before React Compiler walks or replaces any component subtree.
  // A shared Babel traversal can otherwise miss attributes on cloned JSX.
  const displayVisitors: NonNullable<PluginObj<UiPass>["visitor"]> = {
    JSXText(path, state) {
      if (!state.enabled) return;
      const call = translate(jsxDisplayText(path.node.value), state);
      if (call) {
        path.replaceWith(t.jsxExpressionContainer(call));
        path.skip();
      }
    },
    StringLiteral(path, state) {
      if (!state.enabled) return;
      const parent = path.parentPath;
      if (parent.isJSXAttribute()) {
        if (!t.isJSXIdentifier(parent.node.name) || !DISPLAY_FIELDS.has(parent.node.name.name))
          return;
        const call = translate(path.node.value, state);
        if (call) {
          path.replaceWith(t.jsxExpressionContainer(call));
          path.skip();
        }
        return;
      }
      if (parent.isObjectProperty() && parent.node.key === path.node) return;
      if (parent.isImportDeclaration() || parent.isExportDeclaration() || parent.isTSType()) return;
      if (
        parent.isObjectProperty() &&
        parent.parentPath.isObjectExpression() &&
        parent.parentPath.node.properties.some(
          (property) =>
            t.isObjectProperty(property) &&
            !property.computed &&
            RECORD_FIELDS.has(
              t.isIdentifier(property.key)
                ? property.key.name
                : t.isStringLiteral(property.key)
                  ? property.key.value
                  : "",
            ),
        )
      )
        return;
      let display =
        parent.isObjectProperty() &&
        !parent.node.computed &&
        DISPLAY_FIELDS.has(
          t.isIdentifier(parent.node.key)
            ? parent.node.key.name
            : t.isStringLiteral(parent.node.key)
              ? parent.node.key.value
              : "",
        );
      // These maps contain display strings; arbitrary state, protocol, and
      // command values are deliberately excluded from localization.
      if (!display && parent.isObjectProperty()) {
        const variable = parent.findParent((p) => p.isVariableDeclarator());
        display =
          !!variable &&
          variable.isVariableDeclarator() &&
          t.isIdentifier(variable.node.id) &&
          /_(LABELS|DESCRIPTIONS|TITLES|MESSAGES)$/.test(variable.node.id.name);
      }
      if (!display) {
        let childKey = path.key;
        let cursor = parent;
        while (
          cursor.isConditionalExpression() ||
          cursor.isLogicalExpression() ||
          cursor.isBinaryExpression() ||
          cursor.isParenthesizedExpression()
        ) {
          // A comparison is state/protocol logic, even when it sits inside
          // JSX. Only output branches and display concatenations qualify.
          if (
            (cursor.isConditionalExpression() && childKey === "test") ||
            (cursor.isLogicalExpression() && childKey === "left") ||
            (cursor.isBinaryExpression() && cursor.node.operator !== "+")
          )
            return;
          childKey = cursor.key;
          if (!cursor.parentPath) return;
          cursor = cursor.parentPath;
        }
        display =
          cursor.isJSXExpressionContainer() &&
          (!cursor.parentPath.isJSXAttribute() ||
            (t.isJSXIdentifier(cursor.parentPath.node.name) &&
              DISPLAY_FIELDS.has(cursor.parentPath.node.name.name)));
      }
      if (display) {
        const call = translate(path.node.value, state);
        if (call) {
          path.replaceWith(call);
          path.skip();
        }
      }
    },
  };
  return {
    name: "t3code-ui-localization",
    visitor: {
      Program(path, state) {
        const file = (state.filename ?? "").replaceAll("\\", "/");
        state.enabled =
          /\/apps\/web\/src\/(components|routes|onboarding)\//.test(file) &&
          !/\.(test|spec)\./.test(file);
        if (!state.enabled) return;
        state.uiId = path.scope.generateUidIdentifier("uiText");
        state.used = false;
        path.traverse(displayVisitors, state);
        if (state.used)
          path.unshiftContainer(
            "body",
            t.importDeclaration(
              [t.importSpecifier(t.cloneNode(state.uiId), t.identifier("uiText"))],
              t.stringLiteral("~/i18n/uiLocale"),
            ),
          );
      },
    },
  };
}
