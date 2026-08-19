const DUMP_HEADER = /^\*\*\* IR Dump (Before|After) (.+?) on (.+?) \*\*\*$/gm;
const FUNCTION_DEFINITION =
  /^\s*define\s+[^@\n]*@(?:"((?:\\.|[^"])*)"|([^\s(]+))\s*\(/gm;
const BLOCK_LABEL = /^\s*("(?:\\.|[^"])+"|[-A-Za-z$._0-9]+):\s*$/;
const LOCAL_ASSIGNMENT = /^%(?:"(?:\\.|[^"])+"|[-A-Za-z$._0-9]+)\s*=\s*/;
const LABEL_REFERENCE = /label\s+%("(?:\\.|[^"])+"|[-A-Za-z$._0-9]+)/g;
const INSTRUCTION_OPCODE = new RegExp(
  "^(?:tail\\s+|musttail\\s+|notail\\s+)?" +
    "(alloca|load|store|getelementptr|fence|cmpxchg|atomicrmw|" +
    "add|fadd|sub|fsub|mul|fmul|fneg|udiv|sdiv|fdiv|urem|srem|frem|" +
    "shl|lshr|ashr|and|or|xor|extractelement|insertelement|" +
    "shufflevector|extractvalue|insertvalue|trunc|zext|sext|" +
    "fptrunc|fpext|fptoui|fptosi|uitofp|sitofp|ptrtoint|" +
    "inttoptr|bitcast|addrspacecast|icmp|fcmp|phi|select|freeze|" +
    "call|va_arg|landingpad|catchpad|cleanuppad|ret|br|switch|" +
    "indirectbr|invoke|callbr|resume|catchswitch|catchret|" +
    "cleanupret|unreachable)\\b",
);
const MEMORY_OPCODES = new Set([
  "load",
  "store",
  "fence",
  "cmpxchg",
  "atomicrmw",
]);
const BRANCH_OPCODES = new Set([
  "br",
  "switch",
  "indirectbr",
  "invoke",
  "callbr",
  "catchswitch",
]);
const TERMINATOR_OPCODES = new Set([
  ...BRANCH_OPCODES,
  "ret",
  "resume",
  "catchret",
  "cleanupret",
  "unreachable",
]);

const {
  DEFAULT_TRANSFORMATION_CATEGORY,
  TRANSFORMATION_CATEGORIES,
  transformationSummary,
} = require("./optimisation-content");

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

function stripIrComment(line) {
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (escaped) {
      escaped = false;
    } else if (character === "\\" && quoted) {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ";" && !quoted) {
      return line.slice(0, index);
    }
  }

  return line;
}

function instructionOpcode(line) {
  const statement = stripIrComment(line).trim().replace(LOCAL_ASSIGNMENT, "");
  return INSTRUCTION_OPCODE.exec(statement)?.[1];
}

function findFunctionEnd(ir, openingBrace) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let comment = false;

  for (let index = openingBrace; index < ir.length; index += 1) {
    const character = ir[index];

    if (character === "\n") {
      comment = false;
      continue;
    }
    if (comment) {
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ";" && !quoted) {
      comment = true;
      continue;
    }
    if (quoted) {
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findFunctionOpeningBrace(ir, parameterOpeningParenthesis) {
  let parenthesisDepth = 0;
  let quoted = false;
  let escaped = false;
  let comment = false;

  for (let index = parameterOpeningParenthesis; index < ir.length; index += 1) {
    const character = ir[index];

    if (character === "\n") {
      comment = false;
      continue;
    }
    if (comment) {
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ";" && !quoted) {
      comment = true;
      continue;
    }
    if (quoted) {
      continue;
    }
    if (character === "(") {
      parenthesisDepth += 1;
    } else if (character === ")") {
      parenthesisDepth -= 1;
    } else if (character === "{" && parenthesisDepth === 0) {
      return index;
    }
  }

  return -1;
}

function extractFunctionSnapshots(ir) {
  const snapshots = [];
  let match;

  FUNCTION_DEFINITION.lastIndex = 0;
  while ((match = FUNCTION_DEFINITION.exec(ir)) !== null) {
    const name = match[1] ?? match[2];
    const openingBrace = findFunctionOpeningBrace(
      ir,
      FUNCTION_DEFINITION.lastIndex - 1,
    );
    if (!name || openingBrace === -1) {
      continue;
    }

    const closingBrace = findFunctionEnd(ir, openingBrace);
    if (closingBrace === -1) {
      continue;
    }

    snapshots.push({ name, body: ir.slice(openingBrace + 1, closingBrace) });
    FUNCTION_DEFINITION.lastIndex = closingBrace + 1;
  }

  return snapshots;
}

function normaliseIdentifier(identifier) {
  return identifier.startsWith('"') && identifier.endsWith('"')
    ? identifier.slice(1, -1)
    : identifier;
}

function graphNodeId(functionName, blockName) {
  return `bb:${encodeURIComponent(functionName)}:${encodeURIComponent(blockName)}`;
}

function parseFunctionSnapshot({ name, body }) {
  const blocks = [];
  let current = { name: "entry", lines: [] };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = stripIrComment(rawLine).trim();
    if (!line) {
      continue;
    }

    const label = BLOCK_LABEL.exec(line);
    if (label) {
      const blockName = normaliseIdentifier(label[1]);
      if (current.lines.length === 0 && blocks.length === 0) {
        current.name = blockName;
      } else {
        blocks.push(current);
        current = { name: blockName, lines: [] };
      }
      continue;
    }

    current.lines.push(line);
  }

  if (current.lines.length > 0 || blocks.length > 0) {
    blocks.push(current);
  }

  const blockNames = new Set(blocks.map((block) => block.name));
  let graphIsValid = blockNames.size === blocks.length;

  const nodes = blocks.map((block) => {
    const preview = block.lines.slice(0, 4).join("\n");
    return {
      id: graphNodeId(name, block.name),
      label: `${block.name}${preview ? `\n${preview}` : ""}`.slice(0, 1_024),
    };
  });
  const edges = [];
  const edgeIds = new Set();
  let instructions = 0;
  let memoryOperations = 0;
  let branches = 0;

  for (const block of blocks) {
    let terminatorIndex = -1;
    block.lines.forEach((line, index) => {
      const opcode = instructionOpcode(line);
      if (!opcode) {
        return;
      }
      instructions += 1;
      if (MEMORY_OPCODES.has(opcode)) {
        memoryOperations += 1;
      }
      if (BRANCH_OPCODES.has(opcode)) {
        branches += 1;
      }
      if (TERMINATOR_OPCODES.has(opcode)) {
        terminatorIndex = index;
      }
    });

    if (terminatorIndex === -1) {
      continue;
    }

    const terminator = block.lines.slice(terminatorIndex).join(" ");
    LABEL_REFERENCE.lastIndex = 0;
    let target;
    while ((target = LABEL_REFERENCE.exec(terminator)) !== null) {
      const targetName = normaliseIdentifier(target[1]);
      if (!blockNames.has(targetName)) {
        graphIsValid = false;
        continue;
      }
      const source = graphNodeId(name, block.name);
      const destination = graphNodeId(name, targetName);
      const edgeId = `${source}\u0000${destination}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        edges.push({ source, target: destination });
      }
    }
  }

  return {
    graph: graphIsValid ? { nodes, edges } : undefined,
    metrics: {
      instructions,
      memoryOperations,
      basicBlocks: blocks.length,
      branches,
      cyclomaticComplexity: Math.max(edges.length - blocks.length + 2, 1),
    },
  };
}

function analyseIr(ir) {
  const functions = new Map();
  const snapshots = extractFunctionSnapshots(ir);
  const totals = {
    instructions: 0,
    memoryOperations: 0,
    basicBlocks: 0,
    branches: 0,
    cyclomaticComplexity: 0,
  };

  for (const snapshot of snapshots) {
    const analysis = parseFunctionSnapshot(snapshot);
    functions.set(snapshot.name, analysis);
    for (const key of Object.keys(totals)) {
      totals[key] += analysis.metrics[key];
    }
  }

  return {
    functions,
    metrics: snapshots.length > 0 ? totals : undefined,
  };
}

function createMetrics(before, after) {
  if (!before.metrics || !after.metrics) {
    return undefined;
  }

  return Object.fromEntries(
    Object.keys(before.metrics).map((key) => [
      key,
      {
        before: before.metrics[key],
        after: after.metrics[key],
        delta: after.metrics[key] - before.metrics[key],
        estimated: true,
      },
    ]),
  );
}

function createCfg(scope, before, after, functionNamesById) {
  if (!("functionId" in scope) || scope.functionId === undefined) {
    return undefined;
  }

  const functionName = functionNamesById.get(scope.functionId);
  const beforeFunction = functionName && before.functions.get(functionName);
  const afterFunction = functionName && after.functions.get(functionName);
  if (!beforeFunction?.graph || !afterFunction?.graph) {
    return undefined;
  }

  return { before: beforeFunction.graph, after: afterFunction.graph };
}

function transformationCategory(name) {
  return (
    TRANSFORMATION_CATEGORIES.find(({ pattern }) => pattern.test(name))
      ?.category ?? DEFAULT_TRANSFORMATION_CATEGORY
  );
}

function createTransformation(type, changed, fullName, name, metrics) {
  if (type !== "transform") {
    return undefined;
  }

  return {
    category: transformationCategory(name),
    summary: changed
      ? metrics
        ? transformationSummary.changed(fullName, metrics)
        : transformationSummary.changedWithoutMetrics(fullName)
      : transformationSummary.unchanged(fullName),
  };
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
  const functionNamesById = new Map(functions.map((fn) => [fn.id, fn.name]));
  const blocks = parseDumpBlocks(beforeAfterLog, sourceFile);
  const passes = [];
  const analysisCache = new Map();

  const analysisFor = (ir) => {
    if (!analysisCache.has(ir)) {
      analysisCache.set(ir, analyseIr(ir));
    }
    return analysisCache.get(ir);
  };

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
    const type = isAnalysis ? "analysis" : "transform";
    const scope = createScope(before.target, before.ir, functionNames, order);
    const beforeAnalysis = analysisFor(before.ir);
    const afterAnalysis = analysisFor(after.ir);
    const metrics = createMetrics(beforeAnalysis, afterAnalysis);
    const cfg = createCfg(
      scope,
      beforeAnalysis,
      afterAnalysis,
      functionNamesById,
    );
    const transformation = createTransformation(
      type,
      changed,
      before.fullName,
      name,
      metrics,
    );

    passes.push({
      id: `llvm14:${String(order).padStart(4, "0")}:${name}`,
      order,
      name,
      fullName: before.fullName,
      type,
      scope,
      changed,
      ir: { before: before.ir, after: after.ir },
      ...(metrics ? { metrics } : {}),
      ...(cfg ? { cfg } : {}),
      ...(transformation ? { transformation } : {}),
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
