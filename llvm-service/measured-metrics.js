const { execFile } = require("child_process");
const { randomUUID } = require("crypto");
const { writeFile, unlink } = require("fs/promises");
const { tmpdir } = require("os");
const { join } = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const DUMP_HEADER = /^\*\*\* IR Dump (Before|After) (.+?) on (.+?) \*\*\*$/gm;
const METRIC_KEYS = [
  "instructions",
  "memoryOperations",
  "basicBlocks",
  "branches",
  "cyclomaticComplexity",
];

function parseCollectorEvents(output) {
  const events = [];
  const passStack = [];
  let cfgCapture;

  const decodeHex = (value) => {
    if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
      throw new Error("LLVM CFG output contained invalid hexadecimal data");
    }
    return Buffer.from(value, "hex").toString("utf8");
  };

  for (const line of output.trim().split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");

    if (cfgCapture) {
      if (fields[0] === "N") {
        if (fields.length !== 3) {
          throw new Error("LLVM CFG output contained an invalid node");
        }
        const name = decodeHex(fields[1]);
        cfgCapture.nodes.push({
          id: `bb:${encodeURIComponent(cfgCapture.functionName)}:${encodeURIComponent(name)}`,
          label: decodeHex(fields[2]),
        });
        continue;
      }

      if (fields[0] === "E") {
        if (fields.length !== 3) {
          throw new Error("LLVM CFG output contained an invalid edge");
        }
        const source = decodeHex(fields[1]);
        const target = decodeHex(fields[2]);
        cfgCapture.edges.push({
          source: `bb:${encodeURIComponent(cfgCapture.functionName)}:${encodeURIComponent(source)}`,
          target: `bb:${encodeURIComponent(cfgCapture.functionName)}:${encodeURIComponent(target)}`,
        });
        continue;
      }

      if (fields[0] === "Z" && fields.length === 1) {
        const currentPass = passStack.at(-1);
        if (!currentPass || currentPass.passName !== cfgCapture.passName) {
          throw new Error("LLVM CFG output did not match the active Pass");
        }
        const destination =
          cfgCapture.phase === "Before"
            ? currentPass.cfgByFunction
            : currentPass.afterCfgByFunction;
        destination.set(cfgCapture.functionName, {
          nodes: cfgCapture.nodes,
          edges: cfgCapture.edges,
        });
        cfgCapture = undefined;
        continue;
      }

      throw new Error("LLVM CFG output contained an invalid record");
    }

    if (fields[0] === "C") {
      if (
        fields.length !== 4 ||
        !["B", "A"].includes(fields[1]) ||
        !fields[2] ||
        !fields[3]
      ) {
        throw new Error("LLVM CFG output contained an invalid header");
      }
      cfgCapture = {
        phase: fields[1] === "B" ? "Before" : "After",
        passName: decodeHex(fields[2]),
        functionName: decodeHex(fields[3]),
        nodes: [],
        edges: [],
      };
      continue;
    }

    if (fields[0] === "D") {
      if (fields.length !== 2 || !fields[1]) {
        throw new Error(
          "LLVM metrics output contained an invalid analysis event",
        );
      }
      const currentPass = passStack.at(-1);
      if (
        currentPass &&
        !currentPass.analysisActivity.computed.includes(fields[1])
      ) {
        currentPass.analysisActivity.computed.push(fields[1]);
      }
      continue;
    }

    if (fields[0] === "P") {
      if (fields.length !== 2 || !["all", "not-all"].includes(fields[1])) {
        throw new Error(
          "LLVM metrics output contained an invalid preservation event",
        );
      }
      const currentPass = passStack.at(-1);
      if (currentPass) currentPass.analysisActivity.preservation = fields[1];
      continue;
    }

    if (fields[0] === "X") {
      if (fields.length !== 2 || !fields[1]) {
        throw new Error(
          "LLVM metrics output contained an invalid invalidation event",
        );
      }
      passStack.pop();
      continue;
    }

    if (
      fields.length !== METRIC_KEYS.length + 2 ||
      !["B", "A"].includes(fields[0]) ||
      !fields[1]
    ) {
      throw new Error("LLVM metrics output contained an invalid field count");
    }

    const values = fields.slice(2).map(Number);
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error("LLVM metrics output contained an invalid metric value");
    }
    const event = {
      phase: fields[0] === "B" ? "Before" : "After",
      passName: fields[1],
      metrics: Object.fromEntries(
        METRIC_KEYS.map((key, metricIndex) => [key, values[metricIndex]]),
      ),
      analysisActivity: { computed: [], preservation: "not-all" },
      cfgByFunction:
        fields[0] === "B"
          ? new Map()
          : (passStack.at(-1)?.afterCfgByFunction ?? new Map()),
      afterCfgByFunction: new Map(),
    };
    events.push(event);
    if (fields[0] === "B") passStack.push(event);
    else passStack.pop();
  }

  if (cfgCapture) {
    throw new Error("LLVM CFG output ended before the current graph completed");
  }

  return events;
}

function passNamesMatch(eventName, dumpName) {
  return eventName === dumpName || eventName.endsWith(`::${dumpName}`);
}

function parseMeasuredPassData(output, beforeAfterLog) {
  const events = parseCollectorEvents(output);
  const headers = [...beforeAfterLog.matchAll(DUMP_HEADER)];
  const metricsByDump = [];
  const analysesByDump = [];
  const cfgByDump = [];
  let eventIndex = 0;

  for (let dumpIndex = 0; dumpIndex < headers.length; dumpIndex += 1) {
    const header = headers[dumpIndex];
    let matchingEventIndex = eventIndex;
    while (
      matchingEventIndex < events.length &&
      (events[matchingEventIndex].phase !== header[1] ||
        !passNamesMatch(events[matchingEventIndex].passName, header[2]))
    ) {
      matchingEventIndex += 1;
    }
    if (matchingEventIndex < events.length) {
      const event = events[matchingEventIndex];
      metricsByDump[dumpIndex] = event.metrics;
      if (event.phase === "Before") {
        analysesByDump[dumpIndex] = event.analysisActivity;
      }
      if (event.cfgByFunction.size > 0) {
        cfgByDump[dumpIndex] = event.cfgByFunction;
      }
      eventIndex = matchingEventIndex + 1;
    }
  }

  return { analysesByDump, cfgByDump, metricsByDump };
}

function parseMeasuredMetrics(output, beforeAfterLog) {
  return parseMeasuredPassData(output, beforeAfterLog).metricsByDump;
}

async function measureIrDumpData(beforeAfterLog, originalIr, level) {
  const irPath = join(tmpdir(), `${randomUUID()}_original.ll`);

  try {
    await writeFile(irPath, originalIr);
    const executable = process.env.LLVM_METRICS_BIN ?? "llvm-ir-metrics";
    let stdout;
    let stderr;
    try {
      // The collector must rebuild the same pipeline `opt` ran; a mismatched
      // level produces pass events that do not line up with the dump log.
      ({ stdout, stderr } = await execFileAsync(executable, [irPath, level], {
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      }));
    } catch (error) {
      const stderr =
        error instanceof Error && "stderr" in error
          ? String(error.stderr).trim()
          : "";
      const signal =
        error instanceof Error && "signal" in error
          ? String(error.signal)
          : "unknown";
      throw new Error(
        `LLVM IR metrics collector failed (${signal})${stderr ? `: ${stderr}` : ""}`,
        { cause: error },
      );
    }
    const measuredData = parseMeasuredPassData(stdout, beforeAfterLog);
    const { metricsByDump } = measuredData;
    const dumpHeaders = [...beforeAfterLog.matchAll(DUMP_HEADER)];
    const unavailableIndexes = dumpHeaders
      .map((header, index) => ({ header, index }))
      .filter(
        ({ header, index }) =>
          metricsByDump[index] === undefined &&
          !header[3].endsWith(" (invalidated)"),
      )
      .map(({ index }) => index);
    if (unavailableIndexes.length > 0) {
      throw new Error(
        `LLVM could not measure dump snapshots ${unavailableIndexes.join(", ")}${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
      );
    }
    return measuredData;
  } finally {
    await unlink(irPath).catch(() => undefined);
  }
}

module.exports = {
  measureIrDumpData,
  parseMeasuredMetrics,
  parseMeasuredPassData,
};
