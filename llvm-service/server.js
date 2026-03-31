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

// POST / Compile Endpoint
// Body:    { source: string }   - contents of the .c file
// Returns: { ir: string }       - contents of the generated .ll file

app.post("/compile", async (req, res) => {
  const { source } = req.body;

  if (!source || typeof source !== "string") {
    return res.status(400).json({ error: "source is required" });
  }

  if (source.length > 50_000) {
    return res.status(400).json({ error: "source exceeds 50,000 character limit" });
  }

  const id      = crypto.randomUUID();
  const srcPath = join(tmpdir(), `${id}.c`);
  const irPath  = join(tmpdir(), `${id}.ll`);

  try {
    await writeFile(srcPath, source);

    await execAsync(
      `clang -O0 -Xclang -disable-O0-optnone -S -emit-llvm "${srcPath}" -o "${irPath}"`,
      { timeout: 10_000 }
    );

    const ir = await readFile(irPath, "utf-8");
    res.json({ ir });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    // Always clean up temp files
    await Promise.allSettled([unlink(srcPath), unlink(irPath)]);
  }
});

// Start Server

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`LLVM service running on :${PORT}`));