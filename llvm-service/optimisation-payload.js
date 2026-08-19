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
const { createStructuredDiff } = require("./structured-diff");

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

function splitTopLevel(value, separator) {
  const parts = [];
  const openingDelimiters = new Set(["(", "[", "{", "<"]);
  const closingDelimiters = new Set([")", "]", "}", ">"]);
  let start = 0;
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
    } else if (character === "\\" && quoted) {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && openingDelimiters.has(character)) {
      depth += 1;
    } else if (!quoted && closingDelimiters.has(character)) {
      depth -= 1;
    } else if (!quoted && depth === 0 && separator(character)) {
      const part = value.slice(start, index).trim();
      if (part) {
        parts.push(part);
      }
      start = index + 1;
    }
  }

  const finalPart = value.slice(start).trim();
  if (finalPart) {
    parts.push(finalPart);
  }

  return parts;
}

function findParameterListEnd(ir, openingParenthesis) {
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = openingParenthesis; index < ir.length; index += 1) {
    const character = ir[index];

    if (escaped) {
      escaped = false;
    } else if (character === "\\" && quoted) {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === "(") {
      depth += 1;
    } else if (!quoted && character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractFunctionSignature(ir, definitionMatch) {
  const definitionPrefix = definitionMatch[0];
  const atIndex = definitionPrefix.indexOf("@");
  const returnTypeParts = splitTopLevel(
    definitionPrefix.slice("define".length, atIndex).trim(),
    (character) => /\s/.test(character),
  );
  let returnType = returnTypeParts.at(-1);

  if (
    returnTypeParts.length >= 2 &&
    /^addrspace\(\d+\)$/.test(returnType ?? "")
  ) {
    returnType = `${returnTypeParts.at(-2)} ${returnType}`;
  }

  const parameterOpeningParenthesis =
    definitionMatch.index + definitionPrefix.length - 1;
  const parameterClosingParenthesis = findParameterListEnd(
    ir,
    parameterOpeningParenthesis,
  );
  if (!returnType || parameterClosingParenthesis === -1) {
    return undefined;
  }

  const parameterList = ir.slice(
    parameterOpeningParenthesis + 1,
    parameterClosingParenthesis,
  );
  const parameterTypes = splitTopLevel(
    parameterList,
    (character) => character === ",",
  ).map((parameter) => {
    if (parameter === "...") {
      return parameter;
    }

    const parts = splitTopLevel(parameter, (character) => /\s/.test(character));
    return /^addrspace\(\d+\)$/.test(parts[1] ?? "")
      ? `${parts[0]} ${parts[1]}`
      : parts[0];
  });

  if (parameterTypes.some((type) => type === undefined)) {
    return undefined;
  }

  return `${returnType} (${parameterTypes.join(", ")})`;
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
      const signature = extractFunctionSignature(ir, match);
      functions.push({
        id: functionId(name),
        name,
        ...(signature ? { signature } : {}),
      });
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

function parseFunctionSnapshot({ body }) {
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
        continue;
      }
      edgeIds.add(`${block.name}\u0000${targetName}`);
    }
  }

  return {
    metrics: {
      instructions,
      memoryOperations,
      basicBlocks: blocks.length,
      branches,
      cyclomaticComplexity: Math.max(edgeIds.size - blocks.length + 2, 1),
    },
  };
}

function analyseIr(ir) {
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
    for (const key of Object.keys(totals)) {
      totals[key] += analysis.metrics[key];
    }
  }

  return {
    metrics: snapshots.length > 0 ? totals : undefined,
  };
}

function createMetricComparisons(before, after, estimated) {
  if (!before || !after) {
    return undefined;
  }

  return Object.fromEntries(
    Object.keys(before).map((key) => [
      key,
      {
        before: before[key],
        after: after[key],
        delta: after[key] - before[key],
        estimated,
      },
    ]),
  );
}

function createEstimatedMetrics(before, after) {
  return createMetricComparisons(before.metrics, after.metrics, true);
}

function createCfg(
  scope,
  beforeCfgByFunction,
  afterCfgByFunction,
  functionNamesById,
) {
  if (!("functionId" in scope) || scope.functionId === undefined) {
    return undefined;
  }

  const functionName = functionNamesById.get(scope.functionId);
  const before = functionName && beforeCfgByFunction?.get(functionName);
  const after = functionName && afterCfgByFunction?.get(functionName);
  if (!before || !after) {
    return undefined;
  }

  return { before, after };
}

function transformationCategory(name) {
  return (
    TRANSFORMATION_CATEGORIES.find(({ pattern }) => pattern.test(name))
      ?.category ?? DEFAULT_TRANSFORMATION_CATEGORY
  );
}

function createTransformation(type, changed, name) {
  if (type !== "transform") {
    return undefined;
  }

  const category = transformationCategory(name);
  return {
    category,
    summary: changed
      ? transformationSummary.changed(category)
      : transformationSummary.unchanged,
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
    dumpIndex: index,
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
  analysesByDump,
  beforeAfterLog,
  measuredCfgByDump,
  measuredMetricsByDump,
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
    const metrics =
      createMetricComparisons(
        measuredMetricsByDump?.[before.dumpIndex],
        measuredMetricsByDump?.[after.dumpIndex],
        false,
      ) ?? createEstimatedMetrics(beforeAnalysis, afterAnalysis);
    const cfg = createCfg(
      scope,
      measuredCfgByDump?.[before.dumpIndex],
      measuredCfgByDump?.[after.dumpIndex],
      functionNamesById,
    );
    const transformation = createTransformation(type, changed, name);
    const diff = changed
      ? createStructuredDiff(before.ir, after.ir)
      : undefined;

    passes.push({
      id: `llvm14:${String(order).padStart(4, "0")}:${name}`,
      order,
      name,
      fullName: before.fullName,
      type,
      scope,
      changed,
      ir: {
        before: before.ir,
        after: after.ir,
        ...(diff ? { diff } : {}),
      },
      ...(metrics ? { metrics } : {}),
      ...(cfg ? { cfg } : {}),
      ...(transformation ? { transformation } : {}),
      ...(analysesByDump
        ? {
            analysisActivity: {
              computed: analysesByDump[before.dumpIndex]?.computed ?? [],
              preservation:
                analysesByDump[before.dumpIndex]?.preservation ?? "not-all",
            },
          }
        : {}),
    });
    index += 1;
  }

  if (passes.length === 0) {
    throw new Error("LLVM optimisation log did not contain paired IR dumps");
  }

  return {
    schemaVersion: "1.1.0",
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
