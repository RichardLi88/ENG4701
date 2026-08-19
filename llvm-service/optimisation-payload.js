const DUMP_HEADER = /^\*\*\* IR Dump (Before|After) (.+?) on (.+?) \*\*\*$/gm;

function sanitiseIr(ir, sourceFile) {
  return ir
    .replace(/\/tmp\/[A-Za-z0-9._-]+\.ll/g, `${sourceFile}.ll`)
    .replace(/\/tmp\/[A-Za-z0-9._-]+\.(?:c|cpp)/g, sourceFile)
    .trim();
}

function extractFunctionName(ir) {
  const match =
    /^\s*define\s+[^@\n]*@(?:"((?:\\.|[^"])*)"|([^\s(]+))\s*\(/m.exec(ir);

  return match?.[1] ?? match?.[2];
}

function extractFunctions(ir) {
  const functions = [];
  const names = new Set();
  const definition =
    /^\s*define\s+[^@\n]*@(?:"((?:\\.|[^"])*)"|([^\s(]+))\s*\(/gm;
  let match;

  while ((match = definition.exec(ir)) !== null) {
    const name = match[1] ?? match[2];

    if (name && !names.has(name)) {
      names.add(name);
      functions.push({ id: functionId(name), name });
    }
  }

  return functions;
}

function functionId(name) {
  return `fn:${encodeURIComponent(name)}`;
}

function passName(fullName) {
  const withoutTemplates = fullName.replace(/<.*>/g, "");
  const withoutSuffix = withoutTemplates.replace(/Pass$/, "");

  return (
    withoutSuffix
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "unknown"
  );
}

function parseDumpBlocks(log, sourceFile) {
  const headers = [...log.matchAll(DUMP_HEADER)];

  return headers.map((header, index) => ({
    phase: header[1],
    fullName: header[2],
    target: header[3],
    ir: sanitiseIr(
      log.slice(
        (header.index ?? 0) + header[0].length,
        headers[index + 1]?.index ?? log.length,
      ),
      sourceFile,
    ),
  }));
}

function createScope(target, ir, functionNames, order) {
  if (target === "[module]") {
    return { level: "module" };
  }

  const normalisedTarget = target.replace(/^\((.*)\)$/, "$1");
  if (functionNames.has(normalisedTarget)) {
    return { level: "function", functionId: functionId(normalisedTarget) };
  }

  const irFunction = extractFunctionName(ir);
  if (/\bLoop\b/i.test(target) && irFunction && functionNames.has(irFunction)) {
    return {
      level: "loop",
      functionId: functionId(irFunction),
      loopId: `loop:${order}`,
    };
  }

  if (irFunction && functionNames.has(irFunction)) {
    return { level: "unknown", functionId: functionId(irFunction) };
  }

  return { level: "unknown" };
}

function createOptimisationPayload({
  beforeAfterLog,
  sourceFile,
  unoptimisedIr,
}) {
  const functions = extractFunctions(unoptimisedIr);
  const functionNames = new Set(functions.map((fn) => fn.name));
  const blocks = parseDumpBlocks(beforeAfterLog, sourceFile);
  const passes = [];

  for (let index = 0; index < blocks.length - 1; index += 1) {
    const before = blocks[index];
    const after = blocks[index + 1];

    if (
      before.phase !== "Before" ||
      after.phase !== "After" ||
      before.fullName !== after.fullName ||
      before.ir.length === 0 ||
      after.ir.length === 0
    ) {
      continue;
    }

    const order = passes.length;
    const changed = before.ir !== after.ir;
    const isAnalysis =
      !changed &&
      /(Analysis|Verifier|Print|RequireAnalysis|AnnotationRemarks)/.test(
        before.fullName,
      );
    const name = passName(before.fullName);

    passes.push({
      id: `llvm14:${String(order).padStart(4, "0")}:${name}`,
      order,
      name,
      fullName: before.fullName,
      type: isAnalysis ? "analysis" : "transform",
      scope: createScope(before.target, before.ir, functionNames, order),
      changed,
      ir: { before: before.ir, after: after.ir },
    });
    index += 1;
  }

  if (passes.length === 0) {
    throw new Error("LLVM optimisation log did not contain paired IR dumps");
  }

  return {
    schemaVersion: "1.0.0",
    meta: {
      sourceFile,
      optimisationLevel: "O1",
      totalPasses: passes.length,
    },
    functions,
    passes,
  };
}

module.exports = { createOptimisationPayload };
