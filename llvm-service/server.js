const express = require("express");
const { exec } = require("child_process");
const { writeFile, readFile, unlink } = require("fs/promises");
const { tmpdir } = require("os");
const { join } = require("path");
const { promisify } = require("util");

const execAsync = promisify(exec);
const app = express();
app.use(express.json({ limit: "2mb" }));

// Health Check

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── POST /compile ──────────────────────────────────────────────────
// Body:    { source: string, filename?: string }  — contents of the .c/.cpp file
// Returns: { ir: string }                          — contents of the generated .ll file

app.post("/compile", async (req, res) => {
  const { source, filename = "input.c" } = req.body;

  if (!source || typeof source !== "string") {
    return res.status(400).json({ error: "source is required" });
  }

  if (source.length > 50_000) {
    return res.status(400).json({ error: "source exceeds 50,000 character limit" });
  }

  const isCpp    = filename.endsWith(".cpp");
  const compiler = isCpp ? "clang++" : "clang";
  const ext      = isCpp ? ".cpp" : ".c";

  const id      = crypto.randomUUID();
  const srcPath = join(tmpdir(), `${id}${ext}`);
  const irPath  = join(tmpdir(), `${id}.ll`);

  try {
    await writeFile(srcPath, source);

    await execAsync(
      `${compiler} -O0 -Xclang -disable-O0-optnone -S -emit-llvm "${srcPath}" -o "${irPath}"`,
      { timeout: 10_000 }
    );

    const ir = await readFile(irPath, "utf-8");
    res.json({ ir });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await Promise.allSettled([unlink(srcPath), unlink(irPath)]);
  }
});

// POST /optimise
// Body: { ir: string }
// Returns: { optimisedIr: string, beforeAfterLog: string }

app.post("/optimise", async (req, res) => {
  const { ir } = req.body;

  if (!ir || typeof ir !== "string") {
    return res.status(400).json({ error: "ir is required" });
  }

  const id = crypto.randomUUID();
  const inPath = join(tmpdir(), `${id}_in.ll`);
  const outPath = join(tmpdir(), `${id}_out.ll`);

  try {
    await writeFile(inPath, ir);

    const { stdout, stderr } = await execAsync(
      `opt -passes="default<O1>" -print-before-all -print-after-all -S "${inPath}" -o "${outPath}"`,
      { timeout: 30_000, maxBuffer: 50 * 1024 * 1024 },
    );

    const optimisedIr = await readFile(outPath, "utf-8");

    res.json({
      optimisedIr,
      beforeAfterLog: stderr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown LLVM error";
    res.status(500).json({ error: message });
  } finally {
    await Promise.allSettled([unlink(inPath), unlink(outPath)]);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
});

// Start Server

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`LLVM service running on :${PORT}`));