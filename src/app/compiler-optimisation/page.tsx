"use client";

import { useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";

type Stage = "idle" | "compiling" | "compiled" | "optimising" | "optimised" | "error";
type ActiveTab = "source" | "ir" | "optimised" | "log";

export default function CompilerOptimisationPage() {
  const [file, setFile]             = useState<File | null>(null);
  const [sourceCode, setSourceCode] = useState<string>("");
  const [ir, setIr]                 = useState<string>("");
  const [optimisedIr, setOptimisedIr]     = useState<string>("");
  const [passLog, setPassLog]       = useState<string>("");
  const [stage, setStage]           = useState<Stage>("idle");
  const [errorMsg, setErrorMsg]     = useState<string>("");
  const [dragging, setDragging]     = useState(false);
  const [activeTab, setActiveTab]   = useState<ActiveTab>("source");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── tRPC mutations ───────────────────────────────────────────────

  const compileMutation = api.compiler.compile.useMutation({
    onSuccess: (data) => {
      setIr(data.ir);
      setStage("compiled");
      setActiveTab("ir");
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setStage("error");
    },
  });

  const optimiseMutation = api.compiler.optimise.useMutation({
    onSuccess: (data) => {
      setOptimisedIr(data.optimisedIr);
      setPassLog(data.beforeAfterLog);
      setStage("optimised");
      setActiveTab("optimised");
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setStage("error");
    },
  });

  // ── File handling ────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".c") && !f.name.endsWith(".cpp")) {
      setErrorMsg("Only .c and .cpp files are supported.");
      setStage("error");
      return;
    }
    const text = await f.text();
    setFile(f);
    setSourceCode(text);
    setStage("idle");
    setIr("");
    setOptimisedIr("");
    setPassLog("");
    setErrorMsg("");
    setActiveTab("source");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const handleCompile = () => {
    if (!file) return;
    setStage("compiling");
    setIr("");
    setOptimisedIr("");
    setPassLog("");
    setErrorMsg("");
    compileMutation.mutate({ source: sourceCode, filename: file.name });
  };

  const handleOptimise = () => {
    if (!ir) return;
    setStage("optimising");
    setOptimisedIr("");
    setPassLog("");
    setErrorMsg("");
    optimiseMutation.mutate({ ir });
  };

  const isCpp        = file?.name.endsWith(".cpp") ?? false;
  const isCompiling  = stage === "compiling";
  const isOptimising = stage === "optimising";
  const hasIr        = !!ir;
  const hasOptimised = !!optimisedIr;

  const tabs: { id: ActiveTab; label: string; dot: string; count?: number; disabled: boolean }[] = [
    { id: "source",    label: "Source",       dot: "#38bdf8", count: sourceCode ? sourceCode.split("\n").length : undefined,    disabled: false },
    { id: "ir",        label: "LLVM IR",      dot: "#f97316", count: ir ? ir.split("\n").length : undefined,                    disabled: !hasIr },
    { id: "optimised", label: "Optimised IR", dot: "#22c55e", count: optimisedIr ? optimisedIr.split("\n").length : undefined,  disabled: !hasOptimised },
    { id: "log",       label: "Pass Log",     dot: "#c084fc", count: passLog ? passLog.split("\n").length : undefined,          disabled: !passLog },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

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
          display: flex; align-items: center; gap: 14px;
          padding: 16px 26px;
          border-bottom: 1px solid #1e1e2e;
          flex-shrink: 0;
        }
        .opt-logo {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700; font-size: 11px; color: #0a0a0f; flex-shrink: 0;
        }
        .opt-title   { font-size: 15px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.3px; }
        .opt-subtitle { font-size: 10px; color: #475569; font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
        .opt-badge {
          margin-left: auto;
          background: #1e1e2e; border: 1px solid #2e2e42; color: #f97316;
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          padding: 3px 10px; border-radius: 20px;
        }

        /* ── Body ── */
        .opt-body {
          flex: 1;
          display: grid;
          grid-template-columns: 264px 1fr;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .opt-sidebar {
          border-right: 1px solid #1e1e2e;
          display: flex; flex-direction: column;
          padding: 20px 16px; gap: 16px; overflow-y: auto;
        }
        .panel-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase; letter-spacing: 2px;
          color: #475569; margin-bottom: 6px;
        }

        /* ── Drop zone ── */
        .drop-zone {
          border: 1.5px dashed #2e2e42; border-radius: 10px;
          padding: 22px 12px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; transition: all 0.2s ease;
          background: #0d0d18; text-align: center;
        }
        .drop-zone:hover, .drop-zone.dragging { border-color: #f97316; background: #14141f; }
        .drop-zone.has-file { border-color: #22c55e; border-style: solid; }
        .drop-icon {
          width: 36px; height: 36px; background: #1e1e2e; border-radius: 8px;
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .drop-main  { font-size: 12px; font-weight: 600; color: #cbd5e1; }
        .drop-sub   { font-size: 10px; color: #475569; font-family: 'JetBrains Mono', monospace; }
        .drop-fname { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #22c55e; font-weight: 500; word-break: break-all; }

        /* ── Command box ── */
        .cmd-box { background: #0d0d18; border: 1px solid #1e1e2e; border-radius: 8px; padding: 10px 12px; }
        .cmd-text { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748b; line-height: 1.9; word-break: break-all; }
        .cmd-text span { color: #f97316; }

        /* ── Buttons ── */
        .action-btn {
          width: 100%; padding: 11px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
          display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .btn-compile {
          background: #f97316; color: #0a0a0f;
        }
        .btn-compile:hover:not(:disabled) { background: #fb923c; transform: translateY(-1px); }
        .btn-compile.active {
          background: #1e1e2e; color: #f97316; border: 1px solid #f97316;
        }
        .btn-optimise {
          background: #22c55e; color: #0a0a0f;
        }
        .btn-optimise:hover:not(:disabled) { background: #4ade80; transform: translateY(-1px); }
        .btn-optimise.active {
          background: #1e1e2e; color: #22c55e; border: 1px solid #22c55e;
        }
        .action-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none !important; }

        /* ── Spinner ── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-orange { width: 13px; height: 13px; border: 2px solid #f97316; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        .spinner-green  { width: 13px; height: 13px; border: 2px solid #22c55e; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }

        /* ── Error ── */
        .error-box {
          background: #1a0a0a; border: 1px solid #7f1d1d;
          border-left: 3px solid #ef4444; border-radius: 8px;
          padding: 9px 11px; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: #fca5a5; line-height: 1.6; word-break: break-all;
        }

        /* ── Stage tracker ── */
        .stage-track {
          display: flex; flex-direction: column; gap: 0;
        }
        .stage-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 0;
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: #334155;
          position: relative;
        }
        .stage-item:not(:last-child)::after {
          content: '';
          position: absolute; left: 6px; top: 22px;
          width: 1px; height: calc(100% - 10px);
          background: #1e1e2e;
        }
        .stage-dot {
          width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0;
          border: 1.5px solid #2e2e42; background: #0d0d18;
          display: flex; align-items: center; justify-content: center;
          font-size: 7px;
        }
        .stage-item.done   .stage-dot { border-color: #22c55e; background: #22c55e; color: #0a0a0f; }
        .stage-item.active .stage-dot { border-color: #f97316; background: #f97316; animation: pulse 1.2s ease infinite; }
        .stage-item.done   { color: #64748b; }
        .stage-item.active { color: #f97316; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

        /* ── Right side ── */
        .opt-right {
          display: flex; flex-direction: column; overflow: hidden;
        }

        /* ── Tab bar ── */
        .tab-bar {
          display: flex; align-items: stretch;
          border-bottom: 1px solid #1e1e2e;
          background: #0a0a0f;
          flex-shrink: 0;
          overflow-x: auto;
        }
        .tab-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 18px;
          background: transparent; border: none;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: #334155; cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s; white-space: nowrap;
          position: relative;
        }
        .tab-btn:hover:not(:disabled) { color: #64748b; background: #0d0d18; }
        .tab-btn.active { color: #e2e8f0; border-bottom-color: currentColor; background: #0d0d18; }
        .tab-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .tab-count {
          background: #1e1e2e; color: #475569;
          font-size: 9px; padding: 1px 6px; border-radius: 8px;
        }
        .tab-btn.active .tab-count { color: #64748b; }

        /* ── Panel body ── */
        .panel-body {
          flex: 1; overflow: hidden; display: flex; flex-direction: column;
        }

        /* ── Code viewer ── */
        .code-scroll {
          flex: 1; overflow: auto; display: flex;
        }
        .code-gutter {
          background: #0d0d18; border-right: 1px solid #1a1a28;
          padding: 14px 0; min-width: 44px; flex-shrink: 0; user-select: none;
        }
        .code-line-num {
          display: block; text-align: right; padding: 0 10px 0 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; line-height: 20px; color: #1e293b;
        }
        .code-area {
          flex: 1; padding: 14px 18px; overflow-x: auto; background: #0a0a0f;
        }
        .code-area pre {
          margin: 0; font-family: 'JetBrains Mono', monospace;
          font-size: 12px; line-height: 20px; color: #94a3b8; white-space: pre;
        }

        /* ── Log viewer ── */
        .log-scroll {
          flex: 1; overflow: auto;
          background: #050508;
          padding: 14px 18px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; line-height: 1.8; color: #475569;
          white-space: pre-wrap; word-break: break-all;
        }
        .log-pass-header { color: #c084fc; font-weight: 700; }
        .log-ir-line     { color: #64748b; }
        .log-before      { color: #38bdf8; }
        .log-after       { color: #22c55e; }

        /* ── Empty state ── */
        .pane-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
        }
        .pane-empty-icon { font-size: 30px; opacity: 0.2; }
        .pane-empty-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #1e293b; }

        /* ── Panel toolbar ── */
        .panel-toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 16px;
          border-bottom: 1px solid #1a1a28;
          background: #0d0d18; flex-shrink: 0;
        }
        .toolbar-stat {
          font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: #334155; background: #1e1e2e; padding: 2px 8px; border-radius: 8px;
        }
        .toolbar-stat.active { color: #f97316; }
        .toolbar-copy {
          background: transparent; border: 1px solid #2e2e42;
          color: #334155; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; padding: 2px 8px; border-radius: 4px;
          cursor: pointer; transition: all 0.15s; margin-left: auto;
        }
        .toolbar-copy:hover { border-color: #f97316; color: #f97316; }

        /* ── Syntax colours ── */
        .c-keyword { color: #c084fc; }
        .c-type    { color: #38bdf8; }
        .c-string  { color: #86efac; }
        .c-comment { color: #334155; font-style: italic; }
        .c-number  { color: #fde68a; }
        .c-preproc { color: #fb923c; }

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
        .fade-in { animation: fadeIn 0.2s ease; }
      `}</style>

      <div className="opt-root">

        {/* ── Header ── */}
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

            {/* File upload */}
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
                    <div className="drop-fname">{file.name}</div>
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
                ref={inputRef} type="file" accept=".c,.cpp"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </div>

            {/* Command preview */}
            <div>
              <div className="panel-label">Commands</div>
              <div className="cmd-box" style={{ marginBottom: 8 }}>
                <div className="cmd-text">
                  <span>{isCpp ? "clang++" : "clang"}</span> -O0 -Xclang{"\n"}
                  -disable-O0-optnone -S -emit-llvm{"\n"}
                  <span>{file?.name ?? "input.c"}</span> -o <span>{file?.name.replace(/\.(c|cpp)$/, ".ll") ?? "out.ll"}</span>
                </div>
              </div>
              <div className="cmd-box">
                <div className="cmd-text">
                  <span>opt</span> -passes=<span>"default&lt;O1&gt;"</span>{"\n"}
                  -print-before-all -print-after-all{"\n"}
                  <span>{file?.name.replace(/\.(c|cpp)$/, ".ll") ?? "out.ll"}</span>
                </div>
              </div>
            </div>

            {/* Stage tracker */}
            <div>
              <div className="panel-label">Pipeline</div>
              <div className="stage-track">
                {[
                  { label: "Upload file",   done: !!file,         active: false },
                  { label: "Compile to IR", done: hasIr,          active: isCompiling },
                  { label: "Optimise IR",   done: hasOptimised,   active: isOptimising },
                ].map((s, i) => (
                  <div key={i} className={`stage-item ${s.done ? "done" : ""} ${s.active ? "active" : ""}`}>
                    <div className="stage-dot">{s.done ? "✓" : ""}</div>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {stage === "error" && (
              <div className="error-box">⚠ {errorMsg}</div>
            )}

            {/* Compile button */}
            <button
              className={`action-btn btn-compile ${isCompiling ? "active" : ""}`}
              onClick={handleCompile}
              disabled={!file || isCompiling || isOptimising}
            >
              {isCompiling
                ? <><div className="spinner-orange" />Compiling…</>
                : <>▶ Compile to IR</>}
            </button>

            {/* Optimise button — only shown once IR exists */}
            {hasIr && (
              <button
                className={`action-btn btn-optimise ${isOptimising ? "active" : ""}`}
                onClick={handleOptimise}
                disabled={isCompiling || isOptimising}
              >
                {isOptimising
                  ? <><div className="spinner-green" />Optimising…</>
                  : <>⚡ Optimise (O1)</>}
              </button>
            )}

          </aside>

          {/* ── Right panel with tabs ── */}
          <div className="opt-right">

            {/* Tab bar */}
            <div className="tab-bar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={tab.disabled}
                >
                  <div className="tab-dot" style={{ background: tab.disabled ? "#1e1e2e" : tab.dot }} />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="tab-count">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="panel-body">

              {/* Source tab */}
              {activeTab === "source" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  {sourceCode ? (
                    <>
                      <div className="panel-toolbar">
                        <span className="toolbar-stat">{sourceCode.split("\n").length} lines</span>
                        <button className="toolbar-copy" onClick={() => void navigator.clipboard.writeText(sourceCode)}>copy</button>
                      </div>
                      <CodeViewer code={sourceCode} mode="c" />
                    </>
                  ) : (
                    <div className="pane-empty">
                      <div className="pane-empty-icon">📄</div>
                      <div className="pane-empty-text">Upload a .c or .cpp file to begin</div>
                    </div>
                  )}
                </div>
              )}

              {/* LLVM IR tab */}
              {activeTab === "ir" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  {ir ? (
                    <>
                      <div className="panel-toolbar">
                        <span className="toolbar-stat active">{ir.split("\n").length} lines</span>
                        <span className="toolbar-stat">unoptimised</span>
                        <button className="toolbar-copy" onClick={() => void navigator.clipboard.writeText(ir)}>copy</button>
                      </div>
                      <CodeViewer code={ir} mode="ir" />
                    </>
                  ) : (
                    <div className="pane-empty">
                      <div className="pane-empty-icon">⬡</div>
                      <div className="pane-empty-text">
                        {isCompiling ? "Compiling…" : "Compile your file to see IR"}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Optimised IR tab */}
              {activeTab === "optimised" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  {optimisedIr ? (
                    <>
                      <div className="panel-toolbar">
                        <span className="toolbar-stat active">{optimisedIr.split("\n").length} lines</span>
                        <span className="toolbar-stat" style={{ color: "#22c55e" }}>O1</span>
                        {ir && (
                          <span className="toolbar-stat">
                            {ir.split("\n").length - optimisedIr.split("\n").length > 0
                              ? `−${ir.split("\n").length - optimisedIr.split("\n").length} lines`
                              : `+${optimisedIr.split("\n").length - ir.split("\n").length} lines`}
                          </span>
                        )}
                        <button className="toolbar-copy" onClick={() => void navigator.clipboard.writeText(optimisedIr)}>copy</button>
                      </div>
                      <CodeViewer code={optimisedIr} mode="ir" />
                    </>
                  ) : (
                    <div className="pane-empty">
                      <div className="pane-empty-icon">⚡</div>
                      <div className="pane-empty-text">
                        {isOptimising ? "Optimising…" : "Run optimisation to see result"}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pass log tab */}
              {activeTab === "log" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                  {passLog ? (
                    <>
                      <div className="panel-toolbar">
                        <span className="toolbar-stat active">{passLog.split("\n").length} lines</span>
                        <span className="toolbar-stat">-print-before-all -print-after-all</span>
                        <button className="toolbar-copy" onClick={() => void navigator.clipboard.writeText(passLog)}>copy</button>
                      </div>
                      <PassLogViewer log={passLog} />
                    </>
                  ) : (
                    <div className="pane-empty">
                      <div className="pane-empty-icon">📋</div>
                      <div className="pane-empty-text">Pass log will appear after optimisation</div>
                    </div>
                  )}
                </div>
              )}

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
    <div className="fade-in code-scroll">
      <div className="code-gutter">
        {lines.map((_, i) => <span key={i} className="code-line-num">{i + 1}</span>)}
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

// ── Pass log viewer ──────────────────────────────────────────────────
// Colours "*** IR Dump Before/After PassName ***" headers distinctly
// so the user can scan through the log easily.

function PassLogViewer({ log }: { log: string }) {
  const lines = log.split("\n");
  return (
    <div className="fade-in log-scroll">
      {lines.map((line, i) => {
        if (/^\*+\s+IR Dump Before/i.test(line)) {
          return <div key={i} className="log-before">{"▼ " + line}</div>;
        }
        if (/^\*+\s+IR Dump After/i.test(line)) {
          return <div key={i} className="log-after">{"▲ " + line}</div>;
        }
        if (/^; \w/.test(line) || /^define |^declare /.test(line)) {
          return <div key={i} className="log-pass-header">{line}</div>;
        }
        return <div key={i} className="log-ir-line">{line}</div>;
      })}
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
  return <>{mergeTokens(tokens).map((t, i) => t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>)}</>;
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
  return <>{mergeTokens(tokens).map((t, i) => t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>)}</>;
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
