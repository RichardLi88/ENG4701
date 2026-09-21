import { splitIrLine } from "../_lib/ir-syntax";
import type { IrEmphasis } from "../_lib/workspace-state";

type IrLineProps = Readonly<{
  content: string;
  emphasis: IrEmphasis;
}>;

/**
 * One line of IR. Under "guided" the tokens that describe nothing about the
 * program are dimmed rather than removed, so what remains reads closer to
 * pseudocode without the pane ever withholding text.
 */
export function IrLine({ content, emphasis }: IrLineProps) {
  if (emphasis === "plain" || content.length === 0) {
    return <>{content || " "}</>;
  }

  return (
    <>
      {splitIrLine(content).map((span, index) =>
        span.muted ? (
          <span key={index} className="text-slate-600 opacity-70">
            {span.text}
          </span>
        ) : (
          <span key={index}>{span.text}</span>
        ),
      )}
    </>
  );
}
