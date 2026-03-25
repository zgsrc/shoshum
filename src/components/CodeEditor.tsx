"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  historyField,
  indentWithTab,
} from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import type { FileFormat } from "@/lib/fileUtils";

const lightTheme: Extension = EditorView.theme({
  "&": { backgroundColor: "#ffffff", color: "#1f2328" },
  ".cm-content": { caretColor: "#0969da" },
  ".cm-cursor": { borderLeftColor: "#0969da" },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#8c959f",
    borderRight: "1px solid #d0d7de",
  },
  ".cm-activeLineGutter": { backgroundColor: "#eaeef2", color: "#1f2328" },
  ".cm-activeLine": { backgroundColor: "#eaeef208" },
  ".cm-selectionBackground": { backgroundColor: "#0969da22 !important" },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#0969da22 !important",
  },
  ".cm-selectionMatch": { backgroundColor: "#0969da15" },
  ".cm-searchMatch": {
    backgroundColor: "#fff8c5",
    outline: "1px solid #d4a72c66",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#ffd33d55",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "#eaeef2",
    border: "1px solid #d0d7de",
    color: "#656d76",
  },
  ".cm-tooltip": {
    backgroundColor: "#ffffff",
    border: "1px solid #d0d7de",
    boxShadow: "0 3px 12px #8c959f33",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#0969da15",
  },
  ".cm-panels": { backgroundColor: "#f6f8fa", color: "#1f2328" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid #d0d7de" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #d0d7de" },
  ".cm-matchingBracket": {
    backgroundColor: "#0969da22",
    outline: "1px solid #0969da55",
  },
});

function legacyLanguageSupport(mode: Parameters<typeof StreamLanguage.define>[0]) {
  return new LanguageSupport(StreamLanguage.define(mode));
}

const GRAPHQL_KEYWORDS = new Set([
  "type",
  "interface",
  "union",
  "enum",
  "scalar",
  "input",
  "schema",
  "extend",
  "directive",
  "query",
  "mutation",
  "subscription",
  "fragment",
  "on",
  "implements",
  "repeatable",
  "true",
  "false",
  "null",
]);

const GRAPHQL_BUILTINS = new Set(["ID", "String", "Int", "Float", "Boolean"]);

const graphqlMode = {
  name: "graphql",
  startState() {
    return { inBlockString: false };
  },
  token(stream: {
    eatSpace: () => boolean;
    match: (value: string | RegExp, consume?: boolean, caseInsensitive?: boolean) => RegExpMatchArray | boolean | null;
    next: () => string | void;
    peek: () => string | void;
    eatWhile: (match: RegExp | ((char: string) => boolean)) => boolean;
    skipToEnd: () => void;
    current: () => string;
  }, state: { inBlockString: boolean }): string | null {
    if (stream.eatSpace()) return null;

    if (state.inBlockString) {
      if (stream.match(/.*?"""/)) {
        state.inBlockString = false;
      } else {
        stream.skipToEnd();
      }
      return "string";
    }

    if (stream.match('"""')) {
      state.inBlockString = true;
      return "string";
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^#.*$/)) return "comment";
    if (stream.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^@[A-Za-z_][\w]*/)) return "meta";
    if (stream.match(/^\$\w+/)) return "variableName";
    if (stream.match(/^![=]?|^[:=(){}\[\]|&]/)) return "operator";

    const ch = stream.peek();
    if (ch && /[A-Za-z_]/.test(ch)) {
      stream.next();
      stream.eatWhile(/[\w]/);
      const word = stream.current();
      if (GRAPHQL_KEYWORDS.has(word)) return "keyword";
      if (GRAPHQL_BUILTINS.has(word)) return "typeName";
      return "variableName";
    }

    stream.next();
    return null;
  },
};

const csvMode = {
  name: "csv",
  startState() {
    return { inQuotedField: false };
  },
  token(stream: {
    sol: () => boolean;
    eol: () => boolean;
    next: () => string | void;
    peek: () => string | void;
    eatSpace: () => boolean;
    match: (value: string | RegExp, consume?: boolean, caseInsensitive?: boolean) => RegExpMatchArray | boolean | null;
    skipToEnd: () => void;
  }, state: { inQuotedField: boolean }): string | null {
    if (!state.inQuotedField && stream.eatSpace()) return null;

    if (state.inQuotedField) {
      while (!stream.eol()) {
        if (stream.match(/""/)) continue;
        if (stream.match('"')) {
          state.inQuotedField = false;
          break;
        }
        stream.next();
      }
      return "string";
    }

    if (stream.match('"')) {
      state.inQuotedField = true;
      return "string";
    }
    if (stream.match(/[,\t;]/)) return "separator";
    if (stream.match(/-?(?:0|[1-9]\d*)(?:\.\d+)?/)) return "number";
    if (stream.match(/(?:true|false|null|yes|no)/i)) return "atom";
    if (stream.sol() && stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }
    while (!stream.eol()) {
      const next = stream.peek();
      if (next == null || next === "," || next === "\t" || next === ";" || next === '"') {
        break;
      }
      stream.next();
    }
    return "string";
  },
};

async function getLanguageExtension(
  format: FileFormat
): Promise<LanguageSupport | null> {
  switch (format) {
    case "graphql":
      return legacyLanguageSupport(graphqlMode);
    case "javascript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ jsx: true, typescript: false });
    }
    case "typescript": {
      const { javascript } = await import("@codemirror/lang-javascript");
      return javascript({ jsx: true, typescript: true });
    }
    case "python": {
      const { python } = await import("@codemirror/lang-python");
      return python();
    }
    case "json": {
      const { json } = await import("@codemirror/lang-json");
      return json();
    }
    case "html": {
      const { html } = await import("@codemirror/lang-html");
      return html();
    }
    case "css": {
      const { css } = await import("@codemirror/lang-css");
      return css();
    }
    case "markdown": {
      const { markdown } = await import("@codemirror/lang-markdown");
      return markdown();
    }
    case "xml": {
      const { xml } = await import("@codemirror/lang-xml");
      return xml();
    }
    case "java": {
      const { java } = await import("@codemirror/lang-java");
      return java();
    }
    case "ruby": {
      const { ruby } = await import("@codemirror/legacy-modes/mode/ruby");
      return legacyLanguageSupport(ruby);
    }
    case "swift": {
      const { swift } = await import("@codemirror/legacy-modes/mode/swift");
      return legacyLanguageSupport(swift);
    }
    case "lua": {
      const { lua } = await import("@codemirror/legacy-modes/mode/lua");
      return legacyLanguageSupport(lua);
    }
    case "r": {
      const { r } = await import("@codemirror/legacy-modes/mode/r");
      return legacyLanguageSupport(r);
    }
    case "protobuf": {
      const { protobuf } = await import("@codemirror/legacy-modes/mode/protobuf");
      return legacyLanguageSupport(protobuf);
    }
    case "diff": {
      const { diff } = await import("@codemirror/legacy-modes/mode/diff");
      return legacyLanguageSupport(diff);
    }
    case "cmake": {
      const { cmake } = await import("@codemirror/legacy-modes/mode/cmake");
      return legacyLanguageSupport(cmake);
    }
    case "cpp": {
      const { cpp } = await import("@codemirror/lang-cpp");
      return cpp();
    }
    case "rust": {
      const { rust } = await import("@codemirror/lang-rust");
      return rust();
    }
    case "sql": {
      const { sql } = await import("@codemirror/lang-sql");
      return sql();
    }
    case "yaml": {
      const { yaml } = await import("@codemirror/lang-yaml");
      return yaml();
    }
    case "php": {
      const { php } = await import("@codemirror/lang-php");
      return php();
    }
    case "go": {
      const { go } = await import("@codemirror/lang-go");
      return go();
    }
    case "shell": {
      const { shell } = await import("@codemirror/legacy-modes/mode/shell");
      return legacyLanguageSupport(shell);
    }
    case "toml": {
      const { toml } = await import("@codemirror/legacy-modes/mode/toml");
      return legacyLanguageSupport(toml);
    }
    case "ini":
    case "properties":
    case "dotenv": {
      const { properties } = await import("@codemirror/legacy-modes/mode/properties");
      return legacyLanguageSupport(properties);
    }
    case "docker": {
      const { dockerFile } = await import("@codemirror/legacy-modes/mode/dockerfile");
      return legacyLanguageSupport(dockerFile);
    }
    case "csv":
      return legacyLanguageSupport(csvMode);
    default:
      return null;
  }
}

export interface EditorSnapshot {
  json: unknown;
  scrollTop: number;
}

export interface CodeEditorRef {
  replaceContent: (text: string) => void;
  goToLine: (line: number) => void;
  takeSnapshot: () => EditorSnapshot | null;
  restoreSnapshot: (snapshot: EditorSnapshot) => void;
}

interface CodeEditorProps {
  content: string;
  format: FileFormat;
  theme: "dark" | "light";
  readOnly?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  tabSize?: number;
  showLineNumbers?: boolean;
  showMinimap?: boolean;
  initialSnapshot?: EditorSnapshot | null;
  onChange?: (content: string) => void;
  onCursorChange?: (line: number, col: number) => void;
}

const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  function CodeEditor(
    {
      content,
      format,
      theme,
      readOnly = false,
      wordWrap = false,
      fontSize = 13,
      tabSize = 2,
      showLineNumbers = true,
      showMinimap = false,
      initialSnapshot = null,
      onChange,
      onCursorChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onCursorRef = useRef(onCursorChange);
    const contentRef = useRef(content);
    const isExternalUpdateRef = useRef(false);
    const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
    const snapshotRef = useRef<EditorSnapshot | null>(initialSnapshot);
    const [minimapTick, setMinimapTick] = useState(0);

    useEffect(() => {
      onChangeRef.current = onChange;
      onCursorRef.current = onCursorChange;
    }, [onChange, onCursorChange]);

    useImperativeHandle(
      ref,
      () => ({
        replaceContent: (text: string) => {
          const view = viewRef.current;
          if (view) {
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: text,
              },
            });
          }
        },
        goToLine: (line: number) => {
          const view = viewRef.current;
          if (view) {
            const clampedLine = Math.min(
              Math.max(1, line),
              view.state.doc.lines
            );
            const lineInfo = view.state.doc.line(clampedLine);
            view.dispatch({
              selection: { anchor: lineInfo.from },
              effects: EditorView.scrollIntoView(lineInfo.from, {
                y: "center",
              }),
            });
            view.focus();
          }
        },
        takeSnapshot: (): EditorSnapshot | null => {
          const view = viewRef.current;
          if (!view) return null;
          return {
            json: view.state.toJSON({ history: historyField }),
            scrollTop: view.scrollDOM.scrollTop,
          };
        },
        restoreSnapshot: (snapshot: EditorSnapshot) => {
          snapshotRef.current = snapshot;
        },
      }),
      []
    );

    const initEditor = useCallback(async () => {
      if (!containerRef.current) return;

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const langExt = await getLanguageExtension(format);
      const isDark = theme === "dark";

      const extensions: Extension[] = [
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        isDark ? oneDark : lightTheme,
        EditorView.theme({
          "&": { height: "100%", fontSize: fontSize + "px" },
          ".cm-scroller": {
            fontFamily:
              "var(--font-geist-mono), 'SF Mono', 'Fira Code', monospace",
            lineHeight: "1.6",
          },
          "&.cm-focused": { outline: "none" },
        }),
        EditorState.tabSize.of(tabSize),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            if (!isExternalUpdateRef.current && onChangeRef.current) {
              onChangeRef.current(newContent);
            }
          }
          if (update.selectionSet && onCursorRef.current) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            onCursorRef.current(line.number, pos - line.from + 1);
          }
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged
          ) {
            setMinimapTick((t) => t + 1);
          }
        }),
      ];

      if (showLineNumbers) extensions.push(lineNumbers());
      if (wordWrap) extensions.push(EditorView.lineWrapping);
      if (langExt) extensions.push(langExt);
      if (readOnly) extensions.push(EditorState.readOnly.of(true));

      const snapshot = snapshotRef.current;
      snapshotRef.current = null;

      const state = snapshot
        ? EditorState.fromJSON(
            snapshot.json as Record<string, unknown>,
            { extensions },
            { history: historyField }
          )
        : EditorState.create({ doc: contentRef.current, extensions });

      viewRef.current = new EditorView({
        state,
        parent: containerRef.current,
      });

      if (snapshot && snapshot.scrollTop > 0) {
        requestAnimationFrame(() => {
          viewRef.current?.scrollDOM.scrollTo(0, snapshot.scrollTop);
        });
      }

      if (showMinimap && minimapCanvasRef.current && viewRef.current) {
        drawMinimap(minimapCanvasRef.current, viewRef.current, theme);
      }

      if (onCursorRef.current) {
        const pos = state.selection.main.head;
        const line = state.doc.lineAt(pos);
        onCursorRef.current(line.number, pos - line.from + 1);
      }
    }, [format, theme, readOnly, wordWrap, fontSize, tabSize, showLineNumbers, showMinimap]);

    useEffect(() => {
      contentRef.current = content;
      initEditor();
      return () => {
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
        }
      };
    }, [initEditor]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      if (content === contentRef.current) return;
      contentRef.current = content;
      const currentDoc = view.state.doc.toString();
      if (content !== currentDoc) {
        isExternalUpdateRef.current = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: content },
        });
        isExternalUpdateRef.current = false;
      }
    }, [content]);

    useEffect(() => {
      if (!showMinimap || !minimapCanvasRef.current || !viewRef.current) return;
      drawMinimap(minimapCanvasRef.current, viewRef.current, theme);
    }, [minimapTick, showMinimap, theme]);

    return (
      <div className="flex h-full w-full overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          style={{ backgroundColor: "var(--sh-bg)" }}
        />
        {showMinimap && (
          <canvas
            ref={minimapCanvasRef}
            className="shrink-0 cursor-pointer"
            style={{
              width: 64,
              backgroundColor: "var(--sh-bg)",
              borderLeft: "1px solid var(--sh-border)",
            }}
            onClick={(e) => {
              const view = viewRef.current;
              if (!view) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientY - rect.top) / rect.height;
              const targetLine =
                Math.floor(ratio * view.state.doc.lines) + 1;
              const clamped = Math.min(targetLine, view.state.doc.lines);
              const pos = view.state.doc.line(clamped).from;
              view.dispatch({
                effects: EditorView.scrollIntoView(pos, { y: "start" }),
              });
            }}
          />
        )}
      </div>
    );
  }
);

function drawMinimap(
  canvas: HTMLCanvasElement,
  view: EditorView,
  theme: "dark" | "light"
) {
  const parent = canvas.parentElement;
  if (!parent) return;

  const dpr = window.devicePixelRatio || 1;
  const width = 64;
  const height = parent.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const doc = view.state.doc;
  const totalLines = doc.lines;
  if (totalLines === 0) return;

  const lineH = Math.max(height / totalLines, 0.5);
  const charW = 0.7;
  const maxChars = Math.floor(width / charW);

  const codeColor =
    theme === "dark" ? "rgba(200, 210, 220, 0.25)" : "rgba(30, 40, 50, 0.2)";

  ctx.fillStyle = codeColor;
  for (let i = 1; i <= totalLines; i++) {
    const lineText = doc.line(i).text;
    const y = (i - 1) * lineH;
    for (let j = 0; j < Math.min(lineText.length, maxChars); j++) {
      if (lineText[j] !== " " && lineText[j] !== "\t") {
        ctx.fillRect(j * charW + 2, y, charW, Math.max(lineH - 0.2, 0.5));
      }
    }
  }

  const { from, to } = view.viewport;
  const fromLine = doc.lineAt(from).number;
  const toLine = doc.lineAt(to).number;
  const vpTop = (fromLine - 1) * lineH;
  const vpHeight = (toLine - fromLine + 1) * lineH;

  const vpColor =
    theme === "dark"
      ? "rgba(100, 150, 255, 0.12)"
      : "rgba(10, 105, 218, 0.08)";
  const vpBorder =
    theme === "dark"
      ? "rgba(100, 150, 255, 0.25)"
      : "rgba(10, 105, 218, 0.2)";

  ctx.fillStyle = vpColor;
  ctx.fillRect(0, vpTop, width, vpHeight);
  ctx.strokeStyle = vpBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, vpTop + 0.5, width - 1, vpHeight - 1);
}

export default CodeEditor;
