import { irDiffContent } from "../content.ts";

export type IrGlossaryEntry = Readonly<{
  token: string;
  group: string;
  meaning: string;
}>;

/**
 * How to tell that a piece of notation is present. Opcodes are matched as whole
 * words so that "add" does not match "padding", and the structural entries have
 * their own shapes.
 */
const PRESENCE: Readonly<Record<string, RegExp>> = {
  define: /^define\b/m,
  "%0": /%\d+/,
  "@name": /@[A-Za-z_.][\w.]*/,
  "label:": /^[A-Za-z0-9_.$-]+:/m,
  "; preds =": /;\s*preds\s*=/,
  br: /\bbr\b/,
  ret: /\bret\b/,
  phi: /\bphi\b/,
  call: /\bcall\b/,
  add: /\badd\b/,
  sub: /\bsub\b/,
  mul: /\bmul\b/,
  icmp: /\bicmp\b/,
  lshr: /\blshr\b/,
  zext: /\bzext\b/,
  trunc: /\btrunc\b/,
  alloca: /\balloca\b/,
  load: /\bload\b/,
  store: /\bstore\b/,
  nsw: /\bnsw\b/,
  align: /\balign\s+\d+/,
  noundef: /\bnoundef\b/,
  i32: /\bi\d+\b/,
};

const ENTRIES: ReadonlyArray<IrGlossaryEntry> =
  irDiffContent.legend.entries.map(([token, group, meaning]) => ({
    token,
    group,
    meaning,
  }));

/**
 * The glossary entries whose notation actually appears in the given IR, in the
 * authored order. Keeping it to what is on screen stops a reader wading through
 * notation their program never uses.
 */
export function selectIrGlossary(
  ...irTexts: ReadonlyArray<string | null | undefined>
): ReadonlyArray<IrGlossaryEntry> {
  const haystack = irTexts.filter(Boolean).join("\n");

  if (haystack.length === 0) return [];

  return ENTRIES.filter((entry) => PRESENCE[entry.token]?.test(haystack));
}
