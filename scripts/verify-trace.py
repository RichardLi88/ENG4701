#!/usr/bin/env python3
"""Compute ground truth for the user study directly from clang and opt.

This deliberately shares no code with the application. It re-implements the
pipeline the service runs, parses the raw dump log itself, and can then compare
the result against what the service reports. Where the two disagree the
application is wrong by definition: the answer key is built from this script.

Usage:
  verify-trace.py run  <source.c> --level O1 [--log-dir DIR]
  verify-trace.py check <source.c> --level O1 [--service URL]
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path

CONTAINER = "ENG4701-llvm-service"
# Both halves of the header can contain spaces: pass names carry template
# arguments ("RequireAnalysisPass<llvm::GlobalsAA, llvm::Module>") and loop
# scopes are prose ("Parallel Loop at depth 1 containing: %2<header>"). No pass
# name contains " on ", so a non-greedy name and a greedy scope split correctly.
DUMP_HEADER = re.compile(r"^\*\*\* IR Dump (Before|After) (.+?) on (.+) \*\*\*$")
ATTRIBUTE_GROUP = re.compile(r"^attributes #\d+ = \{[^}\n]*\}$", re.MULTILINE)
FUNCTION_ATTRS_COMMENT = re.compile(r"^; Function Attrs:.*$", re.MULTILINE)
NOINLINE_TOKEN = re.compile(r"(?<=[{\s:])noinline(?![-\w])[ ]?")
BLOCK_LABEL = re.compile(r"^([A-Za-z0-9_.$-]+):")
TARGET_TRIPLE = re.compile(r'^target triple = "(.+)"$', re.MULTILINE)
DEFINE_LINE = re.compile(r"^define\b")


# --- running clang / opt -------------------------------------------------


def _runner() -> list[str]:
    """Prefer local llvm-14; otherwise borrow the pinned container's toolchain."""
    if shutil.which("clang-14") and shutil.which("opt-14"):
        return []
    if shutil.which("docker"):
        return ["docker", "exec", CONTAINER, "bash", "-lc"]
    sys.exit("need clang-14/opt-14 on PATH, or the LLVM service container running")


def _sh(command: str) -> str:
    prefix = _runner()
    result = subprocess.run(
        [*prefix, command] if prefix else ["bash", "-lc", command],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.exit(f"command failed: {command}\n{result.stderr}")
    return result.stdout


def _push(source: Path, remote: str) -> None:
    if _runner():
        subprocess.run(
            ["docker", "cp", str(source), f"{CONTAINER}:{remote}"], check=True
        )
    else:
        shutil.copy(source, remote)


def _pull(remote: str) -> str:
    if _runner():
        return subprocess.run(
            ["docker", "exec", CONTAINER, "cat", remote],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    return Path(remote).read_text()


def strip_noinline(ir: str) -> str:
    """Independent re-implementation of the service's noinline strip."""
    ir = ATTRIBUTE_GROUP.sub(lambda m: NOINLINE_TOKEN.sub("", m.group(0)), ir)
    return FUNCTION_ATTRS_COMMENT.sub(lambda m: NOINLINE_TOKEN.sub("", m.group(0)), ir)


# --- parsing the dump log ------------------------------------------------


@dataclass
class Pass:
    order: int
    name: str
    scope: str
    changed: bool
    """The After dump covers a different IR unit, so deltas are not comparable."""
    unit_invalidated: bool
    blocks_before: int
    blocks_after: int
    lines_before: int
    lines_after: int


def count_blocks(ir: str) -> int:
    """Basic blocks across every function body in the dump."""
    total = 0
    in_function = False
    for line in ir.splitlines():
        if DEFINE_LINE.match(line):
            in_function = True
            total += 1  # the implicit entry block
            continue
        if in_function and line.startswith("}"):
            in_function = False
            continue
        if in_function and BLOCK_LABEL.match(line):
            total += 1
    return total


def parse_dumps(log: str) -> list[tuple[str, str, str, str]]:
    """Return (direction, pass_name, scope, ir) in file order."""
    dumps: list[tuple[str, str, str, str]] = []
    header: tuple[str, str, str] | None = None
    body: list[str] = []
    for line in log.splitlines():
        match = DUMP_HEADER.match(line)
        if match:
            if header is not None:
                dumps.append((*header, "\n".join(body).strip("\n")))
            header = (match.group(1), match.group(2), match.group(3))
            body = []
        elif header is not None:
            body.append(line)
    if header is not None:
        dumps.append((*header, "\n".join(body).strip("\n")))
    return dumps


def pair_dumps(dumps: list[tuple[str, str, str, str]]) -> list[Pass]:
    """Adjacent Before/After with the same pass name and non-empty IR on both sides."""
    passes: list[Pass] = []
    index = 0
    while index < len(dumps) - 1:
        direction, name, scope, before_ir = dumps[index]
        next_direction, next_name, next_scope, after_ir = dumps[index + 1]
        # When a loop pass deletes its loop, LLVM appends " (invalidated)" to the
        # scope of the After dump and prints the whole module instead of the
        # loop. The documented rule pairs on pass name, so these still pair.
        paired = (
            direction == "Before"
            and next_direction == "After"
            and name == next_name
            and before_ir.strip()
            and after_ir.strip()
        )
        if not paired:
            index += 1
            continue
        passes.append(
            Pass(
                order=len(passes),
                name=name,
                scope=scope,
                unit_invalidated=next_scope.endswith("(invalidated)"),
                changed=before_ir != after_ir,
                blocks_before=count_blocks(before_ir),
                blocks_after=count_blocks(after_ir),
                lines_before=len(before_ir.splitlines()),
                lines_after=len(after_ir.splitlines()),
            )
        )
        index += 2
    return passes


# --- the pipeline --------------------------------------------------------


def run_pipeline(source: Path, level: str) -> tuple[str, list[Pass], str]:
    stem = source.stem
    _push(source, f"/tmp/{stem}.c")
    _sh(
        f"cd /tmp && clang-14 -O0 -Xclang -disable-O0-optnone -S -emit-llvm "
        f"{stem}.c -o {stem}.raw.ll"
    )
    raw_ir = _pull(f"/tmp/{stem}.raw.ll")
    prepared = strip_noinline(raw_ir)
    prepared_path = Path(f"/tmp/{stem}.prepared.ll")
    prepared_path.write_text(prepared)
    _push(prepared_path, f"/tmp/{stem}.in.ll")
    _sh(
        f"cd /tmp && opt-14 -passes='default<{level}>' -print-before-all "
        f"-print-after-all -S {stem}.in.ll -o {stem}.{level}.out.ll "
        f"2> {stem}.{level}.log"
    )
    log = _pull(f"/tmp/{stem}.{level}.log")
    final_ir = _pull(f"/tmp/{stem}.{level}.out.ll")
    return log, pair_dumps(parse_dumps(log)), final_ir


def triple_of(ir: str) -> str | None:
    match = TARGET_TRIPLE.search(ir)
    return match.group(1) if match else None


def summarise(source: Path, level: str, log: str, passes: list[Pass], final_ir: str):
    changed = [p for p in passes if p.changed]
    last = changed[-1].order if changed else None
    return {
        "program": source.name,
        "level": level,
        "target_triple": triple_of(final_ir),
        "total_passes": len(passes),
        "changed_passes": len(changed),
        "changed": [
            {
                "order": p.order,
                "name": p.name,
                "scope": p.scope,
                "blocks": f"{p.blocks_before}->{p.blocks_after}",
            }
            for p in changed
        ],
        "last_change_order": last,
        "last_change_percent": (
            round((last + 1) / len(passes) * 100) if last is not None else None
        ),
        "log_lines": len(log.splitlines()),
        "log_bytes": len(log.encode()),
        "final_ir_lines": len(final_ir.splitlines()),
        "vector_ops_in_final_ir": len(re.findall(r"<\d+ x ", final_ir)),
        "pass_names": sorted({p.name for p in passes}),
    }


# --- comparison against the application ----------------------------------


def app_payload(source: Path, level: str, service: str):
    def post(endpoint, body):
        request = urllib.request.Request(
            f"{service}/{endpoint}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)

    text = source.read_text()
    ir = post("compile", {"source": text, "filename": source.name})["ir"]
    return post(
        "optimise-structured", {"ir": ir, "filename": source.name, "level": level}
    )


def compare(truth: list[Pass], payload, truth_triple: str | None) -> list[str]:
    problems: list[str] = []
    app_passes = payload["passes"]
    # Pass counts are target-specific: the same source gives 96 passes on
    # aarch64 and 97 on x86-64. An answer key is only valid for one target.
    app_triple = triple_of(app_passes[0]["ir"]["before"]) if app_passes else None
    if app_triple != truth_triple:
        problems.append(
            f"target triple: ground truth {truth_triple}, app {app_triple}"
        )
    if len(app_passes) != len(truth):
        problems.append(
            f"pass count: ground truth {len(truth)}, app {len(app_passes)}"
        )
    for index, expected in enumerate(truth):
        if index >= len(app_passes):
            break
        actual = app_passes[index]
        actual_name = actual.get("fullName") or actual["name"]
        if actual_name != expected.name:
            problems.append(
                f"order {index}: ground truth {expected.name}, app {actual_name}"
            )
        elif actual["changed"] != expected.changed:
            problems.append(
                f"order {index} {expected.name}: changed ground truth "
                f"{expected.changed}, app {actual['changed']}"
            )
    estimated = [
        f"{p.get('fullName') or p['name']}@{p['order']}"
        for p in app_passes
        if p.get("metrics")
        and any(m.get("estimated") for m in p["metrics"].values())
    ]
    if estimated:
        problems.append(f"estimated metrics present: {', '.join(estimated[:5])}")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["run", "check"])
    parser.add_argument("source", type=Path)
    parser.add_argument("--level", default="O1")
    parser.add_argument("--log-dir", type=Path, default=Path("study/logs"))
    parser.add_argument("--service", default="http://localhost:3001")
    args = parser.parse_args()

    log, passes, final_ir = run_pipeline(args.source, args.level)
    stats = summarise(args.source, args.level, log, passes, final_ir)

    if args.command == "run":
        args.log_dir.mkdir(parents=True, exist_ok=True)
        log_path = args.log_dir / f"{args.source.stem}.{args.level}.log"
        log_path.write_text(log)
        stats["log_path"] = str(log_path)
    else:
        stats["discrepancies"] = compare(
            passes,
            app_payload(args.source, args.level, args.service),
            stats["target_triple"],
        )

    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
