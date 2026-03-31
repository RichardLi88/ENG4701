"use client";

import { useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";

type CompileState = "idle" | "compiling" | "done" | "error";

export default function CompilerOptimisationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceCode, setSourceCode] = useState<string>("");
  const [ir, setIr] = useState<string>("");
  const [state, setState] = useState<CompileState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compile = api.compiler.compile.useMutation({
    onSuccess: (data) => {
      setIr(data.ir);
      setState("done");
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setState("error");
    },
  });

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".c") && !f.name.endsWith(".cpp")) {
      setErrorMsg("Only .c and .cpp files are supported.");
      setState("error");
      return;
    }
    const text = await f.text();
    setFile(f);
    setSourceCode(text);
    setState("idle");
    setIr("");
    setErrorMsg("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const handleCompile = () => {
    if (!file) return;
    setState("compiling");
    setIr("");
    setErrorMsg("");
    compile.mutate({ source: sourceCode, filename: file.name });
  };

  const isCpp = file?.name.endsWith(".cpp") ?? false;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');

        .opt-root {
          height: 100vh;
          background: #0a0a0f;
          color: #e2e8f0;
          font-family: 'Syne', sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── Header ── */
        .opt-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 28px;
          border-bottom: 1px solid #1e1e2e;
          flex-shrink: 0;
        }
        .opt-logo {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700; font-size: 12px; color: #0a0a0f; flex-shrink: 0;
        }
        .opt-title {
          font-size: 16px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.3px;
        }
        .opt-subtitle {
          font-size: 10px; color: #475569;
          font-family: 'JetBrains Mono', monospace; margin-top: 2px;
        }
        .opt-badge {
          margin-left: auto;
          background: #1e1e2e; border: 1px solid #2e2e42; color: #f97316;
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          padding: 4px 10px; border-radius: 20px;
        }

        /* ── Main layout ── */
        .opt-body {
          flex: 1;
          display: grid;
          grid-template-columns: 280px 1fr;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .opt-sidebar {
          border-right: 1px solid #1e1e2e;
          display: flex; flex-direction: column;
          padding: 22px 18px; gap: 18px; overflow-y: auto;
        }
        .panel-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 2px;
          color: #475569; margin-bottom: 8px;
        }

        /* ── Drop zone ── */
        .drop-zone {
          border: 1.5px dashed #2e2e42; border-radius: 10px;
          padding: 26px 14px;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          cursor: pointer; transition: all 0.2s ease;
          background: #0d0d18; text-align: center;
        }
        .drop-zone:hover, .drop-zone.dragging { border-color: #f97316; background: #14141f; }
        .drop-zone.has-file { border-color: #22c55e; border-style: solid; }
        .drop-icon {
          width: 38px; height: 38px; background: #1e1e2e; border-radius: 9px;
          display: flex; align-items: center; justify-content: center; font-size: 17px;
        }
        .drop-main { font-size: 13px; font-weight: 600; color: #cbd5e1; }
        .drop-sub  { font-size: 11px; color: #475569; font-family: 'JetBrains Mono', monospace; }
        .drop-file-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; color: #22c55e; font-weight: 500; word-break: break-all;
        }

        /* ── Command preview ── */
        .cmd-box {
          background: #0d0d18; border: 1px solid #1e1e2e;
          border-radius: 8px; padding: 12px 13px;
        }
        .cmd-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; color: #64748b; line-height: 1.9; word-break: break-all;
        }
        .cmd-text span { color: #f97316; }

        /* ── Compile button ── */
        .compile-btn {
          width: 100%; padding: 12px;
          background: #f97316; color: #0a0a0f;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px;
          border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .compile-btn:hover:not(:disabled) { background: #fb923c; transform: translateY(-1px); }
        .compile-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .compile-btn.compiling {
          background: #1e1e2e; color: #f97316; border: 1px solid #f97316;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid #f97316; border-top-color: transparent;
          border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        /* ── Error ── */
        .error-box {
          background: #1a0a0a; border: 1px solid #7f1d1d;
          border-left: 3px solid #ef4444; border-radius: 8px;
          padding: 10px 12px; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #fca5a5; line-height: 1.6; word-break: break-all;
        }

        /* ── Two editor panes ── */
        .opt-editors {
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
        }
        .editor-pane {
          display: flex; flex-direction: column; overflow: hidden;
          border-right: 1px solid #1e1e2e;
        }
        .editor-pane:last-child { border-right: none; }

        /* ── Pane header ── */
        .pane-header {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 18px;
          border-bottom: 1px solid #1e1e2e;
          background: #0d0d18; flex-shrink: 0;
        }
        .pane-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .pane-dot-c  { background: #38bdf8; }
        .pane-dot-ir { background: #f97316; }
        .pane-tab {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          color: #475569; text-transform: uppercase; letter-spacing: 1.5px;
        }
        .pane-filename {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #334155; margin-left: 2px;
        }
        .pane-meta { margin-left: auto; display: flex; gap: 8px; align-items: center; }
        .pane-stat {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: #1e293b;
          background: #1e1e2e; padding: 2px 8px; border-radius: 10px;
        }
        .pane-stat.active { color: #f97316; }
        .pane-copy-btn {
          background: transparent; border: 1px solid #2e2e42;
          color: #334155; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; padding: 2px 8px; border-radius: 4px;
          cursor: pointer; transition: all 0.15s;
        }
        .pane-copy-btn:hover { border-color: #f97316; color: #f97316; }

        /* ── Code viewer ── */
        .pane-body { flex: 1; overflow: auto; display: flex; }
        .pane-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
        }
        .pane-empty-icon { font-size: 32px; opacity: 0.2; }
        .pane-empty-text {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #1e293b;
        }
        .code-gutter {
          background: #0d0d18; border-right: 1px solid #1a1a28;
          padding: 16px 0; min-width: 46px; flex-shrink: 0; user-select: none;
        }
        .code-line-num {
          display: block; text-align: right; padding: 0 10px 0 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; line-height: 20px; color: #1e293b;
        }
        .code-area {
          flex: 1; padding: 16px 18px; overflow-x: auto; background: #0a0a0f;
        }
        .code-area pre {
          margin: 0; font-family: 'JetBrains Mono', monospace;
          font-size: 12px; line-height: 20px; color: #94a3b8; white-space: pre;
        }

        /* ── C/C++ colours ── */
        .c-keyword { color: #c084fc; }
        .c-type    { color: #38bdf8; }
        .c-string  { color: #86efac; }
        .c-comment { color: #334155; font-style: italic; }
        .c-number  { color: #fde68a; }
        .c-preproc { color: #fb923c; }

        /* ── LLVM IR colours ── */
        .tok-keyword  { color: #c084fc; }
        .tok-type     { color: #38bdf8; }
        .tok-label    { color: #fb923c; }
        .tok-string   { color: #86efac; }
        .tok-comment  { color: #334155; font-style: italic; }
        .tok-number   { color: #fde68a; }
        .tok-function { color: #f97316; font-weight: 500; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pane-animate { animation: fadeIn 0.25s ease; }
      `}</style>

      <div className="opt-root">
        {/* Header */}
        <header className="opt-header">
          <div className="opt-logo">IR</div>
          <div>
            <div className="opt-title">Compiler Optimisation</div>
            <div className="opt-subtitle">LLVM IR Explorer</div>
          </div>
          <div className="opt-badge">clang · opt</div>
        </header>

        <div className="opt-body">
          {/* ── Sidebar ── */}
          <aside className="opt-sidebar">
            <div>
              <div className="panel-label">Source File</div>
              <div
                className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="drop-icon">{file ? "✅" : "📄"}</div>
                {file ? (
                  <>
                    <div className="drop-file-name">{file.name}</div>
                    <div className="drop-sub">{(file.size / 1024).toFixed(1)} KB · click to change</div>
                  </>
                ) : (
                  <>
                    <div className="drop-main">Drop your file here</div>
                    <div className="drop-sub">.c or .cpp · or click to browse</div>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".c,.cpp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>

            <div>
              <div className="panel-label">Command</div>
              <div className="cmd-box">
                <div className="cmd-text">
                  <span>{isCpp ? "clang++" : "clang"}</span>{" "}
                  -O0 -Xclang{"\n"}-disable-O0-optnone{"\n"}-S -emit-llvm{"\n"}
                  <span>{file ? file.name : "input.c"}</span>{" "}-o{" "}
                  <span>{file ? file.name.replace(/\.(c|cpp)$/, ".ll") : "output.ll"}</span>
                </div>
              </div>
            </div>

            {state === "error" && (
              <div className="error-box">⚠ {errorMsg}</div>
            )}

            <button
              className={`compile-btn ${state === "compiling" ? "compiling" : ""}`}
              onClick={handleCompile}
              disabled={!file || state === "compiling"}
            >
              {state === "compiling"
                ? <><div className="spinner" />Compiling…</>
                : <>▶ Compile to IR</>
              }
            </button>
          </aside>

          {/* ── Two editor panes ── */}
          <div className="opt-editors">

            {/* Source pane */}
            <div className="editor-pane">
              <div className="pane-header">
                <div className="pane-dot pane-dot-c" />
                <span className="pane-tab">Source</span>
                {file && <span className="pane-filename">{file.name}</span>}
                <div className="pane-meta">
                  {sourceCode && (
                    <>
                      <span className="pane-stat">
                        {sourceCode.split("\n").length} lines
                      </span>
                      <button
                        className="pane-copy-btn"
                        onClick={() => void navigator.clipboard.writeText(sourceCode)}
                      >copy</button>
                    </>
                  )}
                </div>
              </div>
              <div className="pane-body">
                {!sourceCode ? (
                  <div className="pane-empty">
                    <div className="pane-empty-icon">📄</div>
                    <div className="pane-empty-text">Upload a file to see source</div>
                  </div>
                ) : (
                  <CodeViewer code={sourceCode} mode="c" />
                )}
              </div>
            </div>

            {/* IR pane */}
            <div className="editor-pane">
              <div className="pane-header">
                <div className="pane-dot pane-dot-ir" />
                <span className="pane-tab">LLVM IR</span>
                {file && (
                  <span className="pane-filename">
                    {file.name.replace(/\.(c|cpp)$/, ".ll")}
                  </span>
                )}
                <div className="pane-meta">
                  {ir && (
                    <>
                      <span className={`pane-stat ${state === "done" ? "active" : ""}`}>
                        {ir.split("\n").length} lines
                      </span>
                      <button
                        className="pane-copy-btn"
                        onClick={() => void navigator.clipboard.writeText(ir)}
                      >copy</button>
                    </>
                  )}
                </div>
              </div>
              <div className="pane-body">
                {!ir ? (
                  <div className="pane-empty">
                    <div className="pane-empty-icon">⬡</div>
                    <div className="pane-empty-text">
                      {state === "compiling"
                        ? "Compiling…"
                        : "IR will appear after compilation"}
                    </div>
                  </div>
                ) : (
                  <CodeViewer code={ir} mode="ir" />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ── Shared code viewer ───────────────────────────────────────────────

function CodeViewer({ code, mode }: { code: string; mode: "c" | "ir" }) {
  const lines = code.split("\n");
  return (
    <div className="pane-animate" style={{ display: "flex", flex: 1, overflow: "auto" }}>
      <div className="code-gutter">
        {lines.map((_, i) => (
          <span key={i} className="code-line-num">{i + 1}</span>
        ))}
      </div>
      <div className="code-area">
        <pre>
          {lines.map((line, i) => (
            <div key={i} style={{ minHeight: "20px" }}>
              {mode === "c" ? <CLine line={line} /> : <IrLine line={line} />}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ── C / C++ tokeniser ────────────────────────────────────────────────

const C_KEYWORDS = new Set([
  "auto","break","case","char","const","continue","default","do","double",
  "else","enum","extern","float","for","goto","if","inline","int","long",
  "register","restrict","return","short","signed","sizeof","static","struct",
  "switch","typedef","union","unsigned","void","volatile","while",
  "nullptr","true","false","bool","class","public","private","protected",
  "new","delete","namespace","using","template","typename","virtual",
  "override","final","this","operator","try","catch","throw","explicit",
  "noexcept","constexpr","decltype","static_assert","thread_local",
]);

function CLine({ line }: { line: string }) {
  if (/^\s*\/\//.test(line)) return <span className="c-comment">{line}</span>;
  if (/^\s*#/.test(line))    return <span className="c-preproc">{line}</span>;

  const tokens: { text: string; cls: string }[] = [];
  let rest = line;

  const rules: [RegExp, string][] = [
    [/^\/\/.*/, "c-comment"],
    [/^\/\*[\s\S]*?\*\//, "c-comment"],
    [/^"(?:[^"\\]|\\.)*"/, "c-string"],
    [/^'(?:[^'\\]|\\.)*'/, "c-string"],
    [/^[a-zA-Z_]\w*/, "maybe-kw"],
    [/^0[xX][0-9a-fA-F]+[uUlL]*/, "c-number"],
    [/^-?\d+\.?\d*([eE][+-]?\d+)?[fFuUlL]*/, "c-number"],
    [/^./, ""],
  ];

  while (rest.length > 0) {
    let matched = false;
    for (const [re, cls] of rules) {
      const m = re.exec(rest);
      if (m) {
        const text = m[0];
        tokens.push({ text, cls: cls === "maybe-kw" ? (C_KEYWORDS.has(text) ? "c-keyword" : "") : cls });
        rest = rest.slice(text.length);
        matched = true;
        break;
      }
    }
    if (!matched) { tokens.push({ text: rest[0]!, cls: "" }); rest = rest.slice(1); }
  }

  const merged = mergeTokens(tokens);
  return (
    <>
      {merged.map((t, i) =>
        t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>
      )}
    </>
  );
}

// ── LLVM IR tokeniser ────────────────────────────────────────────────

function IrLine({ line }: { line: string }) {
  if (/^;/.test(line.trimStart())) return <span className="tok-comment">{line}</span>;

  const tokens: { text: string; cls: string }[] = [];
  let rest = line;

  const rules: [RegExp, string][] = [
    [/^;.*/, "tok-comment"],
    [/^"[^"]*"/, "tok-string"],
    [/^\b(define|declare|ret|br|call|load|store|alloca|getelementptr|icmp|fcmp|phi|select|switch|invoke|unreachable|add|sub|mul|srem|urem|sdiv|udiv|and|or|xor|shl|lshr|ashr|trunc|zext|sext|fpext|fptrunc|bitcast|inttoptr|ptrtoint|extractvalue|insertvalue|inbounds|nuw|nsw|exact|align|attributes|target|datalayout|triple|global|constant|private|internal|external|linkonce|weak|appending|nounwind|readnone|readonly|uwtable|noundef|nocapture|noalias|dereferenceable)\b/, "tok-keyword"],
    [/^\b(i1|i8|i16|i32|i64|i128|float|double|void|ptr|label)\b/, "tok-type"],
    [/^@[\w$.]+/, "tok-function"],
    [/^%[\w$.]+/, "tok-label"],
    [/^-?\d+(\.\d+)?([eE][+-]?\d+)?/, "tok-number"],
    [/^./, ""],
  ];

  while (rest.length > 0) {
    let matched = false;
    for (const [re, cls] of rules) {
      const m = re.exec(rest);
      if (m) {
        tokens.push({ text: m[0], cls });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) { tokens.push({ text: rest[0]!, cls: "" }); rest = rest.slice(1); }
  }

  const merged = mergeTokens(tokens);
  return (
    <>
      {merged.map((t, i) =>
        t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>
      )}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function mergeTokens(tokens: { text: string; cls: string }[]) {
  const out: { text: string; cls: string }[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (last && last.cls === t.cls) last.text += t.text;
    else out.push({ ...t });
  }
  return out;
}
