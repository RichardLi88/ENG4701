"use client";

import { useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";

type CompileState = "idle" | "compiling" | "done" | "error";

export default function CompilerOptimisationPage() {
  const [file, setFile] = useState<File | null>(null);
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

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".c")) {
      setErrorMsg("Only .c files are supported.");
      setState("error");
      return;
    }
    setFile(f);
    setState("idle");
    setIr("");
    setErrorMsg("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleCompile = async () => {
    if (!file) return;
    setState("compiling");
    setIr("");
    setErrorMsg("");
    const source = await file.text();
    compile.mutate({ source });
  };

  const lineCount = ir ? ir.split("\n").length : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');

        .opt-root {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e2e8f0;
          font-family: 'Syne', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── Header ── */
        .opt-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 28px 40px;
          border-bottom: 1px solid #1e1e2e;
        }
        .opt-logo {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 14px;
          color: #0a0a0f;
          flex-shrink: 0;
        }
        .opt-title {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.3px;
        }
        .opt-subtitle {
          font-size: 12px;
          color: #475569;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }
        .opt-badge {
          margin-left: auto;
          background: #1e1e2e;
          border: 1px solid #2e2e42;
          color: #f97316;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          padding: 4px 10px;
          border-radius: 20px;
        }

        /* ── Body layout ── */
        .opt-body {
          flex: 1;
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 0;
          overflow: hidden;
        }

        /* ── Left panel ── */
        .opt-left {
          border-right: 1px solid #1e1e2e;
          display: flex;
          flex-direction: column;
          padding: 32px 28px;
          gap: 24px;
          overflow-y: auto;
        }

        .panel-label {
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #475569;
          margin-bottom: 10px;
        }

        /* ── Drop zone ── */
        .drop-zone {
          border: 1.5px dashed #2e2e42;
          border-radius: 12px;
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #0d0d18;
          text-align: center;
        }
        .drop-zone:hover,
        .drop-zone.dragging {
          border-color: #f97316;
          background: #14141f;
        }
        .drop-zone.has-file {
          border-color: #22c55e;
          border-style: solid;
        }
        .drop-icon {
          width: 48px;
          height: 48px;
          background: #1e1e2e;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .drop-main {
          font-size: 14px;
          font-weight: 600;
          color: #cbd5e1;
        }
        .drop-sub {
          font-size: 12px;
          color: #475569;
          font-family: 'JetBrains Mono', monospace;
        }
        .drop-file-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #22c55e;
          font-weight: 500;
          word-break: break-all;
        }

        /* ── Command preview ── */
        .cmd-box {
          background: #0d0d18;
          border: 1px solid #1e1e2e;
          border-radius: 10px;
          padding: 14px 16px;
        }
        .cmd-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #64748b;
          line-height: 1.7;
          word-break: break-all;
        }
        .cmd-text span { color: #f97316; }

        /* ── Compile button ── */
        .compile-btn {
          width: 100%;
          padding: 14px;
          background: #f97316;
          color: #0a0a0f;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 15px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .compile-btn:hover:not(:disabled) {
          background: #fb923c;
          transform: translateY(-1px);
        }
        .compile-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }
        .compile-btn.compiling {
          background: #1e1e2e;
          color: #f97316;
          border: 1px solid #f97316;
        }

        /* ── Spinner ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f97316;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* ── Error box ── */
        .error-box {
          background: #1a0a0a;
          border: 1px solid #7f1d1d;
          border-left: 3px solid #ef4444;
          border-radius: 8px;
          padding: 12px 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #fca5a5;
          line-height: 1.6;
          word-break: break-all;
        }

        /* ── Right panel (IR viewer) ── */
        .opt-right {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ir-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 28px;
          border-bottom: 1px solid #1e1e2e;
          background: #0d0d18;
          flex-shrink: 0;
        }
        .ir-title {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .ir-meta {
          margin-left: auto;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .ir-stat {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #334155;
          background: #1e1e2e;
          padding: 3px 10px;
          border-radius: 12px;
        }
        .ir-stat.active { color: #f97316; }

        .ir-copy-btn {
          background: transparent;
          border: 1px solid #2e2e42;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ir-copy-btn:hover { border-color: #f97316; color: #f97316; }

        .ir-body {
          flex: 1;
          overflow: auto;
          display: flex;
        }

        /* ── Empty state ── */
        .ir-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: #1e293b;
        }
        .ir-empty-icon {
          font-size: 48px;
          opacity: 0.3;
        }
        .ir-empty-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #1e293b;
        }

        /* ── IR code view ── */
        .ir-gutter {
          background: #0d0d18;
          border-right: 1px solid #1a1a28;
          padding: 20px 0;
          min-width: 52px;
          flex-shrink: 0;
          user-select: none;
        }
        .ir-line-num {
          display: block;
          text-align: right;
          padding: 0 14px 0 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 20px;
          color: #1e293b;
        }
        .ir-code {
          flex: 1;
          padding: 20px 28px;
          overflow-x: auto;
          background: #0a0a0f;
        }
        .ir-code pre {
          margin: 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          line-height: 20px;
          color: #94a3b8;
          white-space: pre;
        }

        /* ── LLVM IR syntax colouring ── */
        .tok-keyword  { color: #c084fc; }
        .tok-type     { color: #38bdf8; }
        .tok-label    { color: #fb923c; }
        .tok-string   { color: #86efac; }
        .tok-comment  { color: #334155; font-style: italic; }
        .tok-number   { color: #fde68a; }
        .tok-function { color: #f97316; font-weight: 500; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ir-animate { animation: fadeIn 0.3s ease; }
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
          {/* ── Left panel ── */}
          <aside className="opt-left">
            {/* Upload */}
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
                    <div className="drop-sub">
                      {(file.size / 1024).toFixed(1)} KB · click to change
                    </div>
                  </>
                ) : (
                  <>
                    <div className="drop-main">Drop your .c file here</div>
                    <div className="drop-sub">or click to browse</div>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".c"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {/* Command preview */}
            <div>
              <div className="panel-label">Command</div>
              <div className="cmd-box">
                <div className="cmd-text">
                  <span>clang</span> -O0 -Xclang -disable-O0-optnone{" "}
                  -S -emit-llvm{" "}
                  <span>{file ? file.name : "input.c"}</span>{" "}
                  -o{" "}
                  <span>{file ? file.name.replace(".c", ".ll") : "output.ll"}</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {state === "error" && (
              <div className="error-box">⚠ {errorMsg}</div>
            )}

            {/* Compile button */}
            <button
              className={`compile-btn ${state === "compiling" ? "compiling" : ""}`}
              onClick={handleCompile}
              disabled={!file || state === "compiling"}
            >
              {state === "compiling" ? (
                <>
                  <div className="spinner" />
                  Compiling…
                </>
              ) : (
                <>▶ Compile to IR</>
              )}
            </button>
          </aside>

          {/* ── Right panel ── */}
          <section className="opt-right">
            <div className="ir-header">
              <span className="ir-title">LLVM IR Output</span>
              <div className="ir-meta">
                {ir && (
                  <>
                    <span className={`ir-stat ${state === "done" ? "active" : ""}`}>
                      {lineCount} lines
                    </span>
                    <button
                      className="ir-copy-btn"
                      onClick={() => void navigator.clipboard.writeText(ir)}
                    >
                      copy
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="ir-body">
              {!ir ? (
                <div className="ir-empty">
                  <div className="ir-empty-icon">⬡</div>
                  <div className="ir-empty-text">
                    {state === "compiling"
                      ? "Compiling…"
                      : "IR will appear here after compilation"}
                  </div>
                </div>
              ) : (
                <IrViewer ir={ir} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ── IR Viewer with line numbers + basic syntax highlighting ──────────

function highlightIr(line: string): React.ReactNode {
  // Comment
  if (line.trimStart().startsWith(";")) {
    return <span className="tok-comment">{line}</span>;
  }

  // Label lines (e.g. "entry:")
  if (/^\s*[\w.]+:(\s|$)/.test(line) && !line.includes("=")) {
    return <span className="tok-label">{line}</span>;
  }

  // Simple token-level colouring via regex replace
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  const patterns: [RegExp, string][] = [
    [/\b(define|declare|ret|br|call|load|store|alloca|getelementptr|icmp|fcmp|phi|select|switch|invoke|unreachable|add|sub|mul|div|and|or|xor|shl|lshr|ashr|trunc|zext|sext|fpext|fptrunc|bitcast|inttoptr|ptrtoint|extractvalue|insertvalue|inbounds|nuw|nsw|exact)\b/, "tok-keyword"],
    [/\b(i1|i8|i16|i32|i64|i128|float|double|void|ptr|label)\b/, "tok-type"],
    [/@[\w.]+/, "tok-function"],
    [/"[^"]*"/, "tok-string"],
    [/\b\d+\b/, "tok-number"],
  ];

  // Just wrap the whole line with a basic scan — good enough for display
  return <HighlightLine line={line} />;
}

function HighlightLine({ line }: { line: string }) {
  // Tokenise left-to-right
  const tokens: { text: string; cls: string }[] = [];
  let rest = line;

  const rules: [RegExp, string][] = [
    [/^;.*/, "tok-comment"],
    [/^"[^"]*"/, "tok-string"],
    [/^\b(define|declare|ret|br|call|load|store|alloca|getelementptr|icmp|fcmp|phi|select|switch|invoke|unreachable|add|sub|mul|srem|urem|sdiv|udiv|and|or|xor|shl|lshr|ashr|trunc|zext|sext|fpext|fptrunc|bitcast|inttoptr|ptrtoint|extractvalue|insertvalue|inbounds|nuw|nsw|exact|align|attributes|target|datalayout|triple|global|constant|private|internal|external|linkonce|weak|common|appending|nounwind|readnone|readonly|uwtable|noundef|nocapture|noalias|dereferenceable)\b/, "tok-keyword"],
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

  // Merge consecutive same-class tokens
  const merged: { text: string; cls: string }[] = [];
  for (const t of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.cls === t.cls) { last.text += t.text; }
    else { merged.push({ ...t }); }
  }

  return (
    <>
      {merged.map((t, i) =>
        t.cls
          ? <span key={i} className={t.cls}>{t.text}</span>
          : <span key={i}>{t.text}</span>
      )}
    </>
  );
}

function IrViewer({ ir }: { ir: string }) {
  const [copied, setCopied] = useState(false);
  const lines = ir.split("\n");

  return (
    <div className="ir-animate" style={{ display: "flex", flex: 1, overflow: "auto" }}>
      {/* Gutter */}
      <div className="ir-gutter">
        {lines.map((_, i) => (
          <span key={i} className="ir-line-num">{i + 1}</span>
        ))}
      </div>

      {/* Code */}
      <div className="ir-code">
        <pre>
          {lines.map((line, i) => (
            <div key={i} style={{ minHeight: "20px" }}>
              <HighlightLine line={line} />
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
