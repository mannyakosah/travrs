import { useEffect, useState } from "react";
import type { TraceRuler } from "../types";
import { Hint, Tape, num, offset, shown, text, type Bag } from "./shared";

export function RollStage({
  ruler,
  before,
  after,
  direction,
}: {
  ruler: TraceRuler;
  before: Bag;
  after: Bag;
  direction: "left" | "right";
}) {
  const { window: win, window_start: windowStart } = ruler;
  const bound0 = num(before, "bound");
  const bound1 = num(after, "bound");
  const seq0 = text(before, "seq") ?? "";
  const seq1 = text(after, "seq") ?? "";
  const len = seq0.length;
  const moved = bound0 !== null && bound1 !== null && bound0 !== bound1;

  const blockStart = (bound: number) => (direction === "left" ? bound : bound - len);
  const from = bound0 === null ? 0 : blockStart(bound0);
  const to = bound1 === null ? from : blockStart(bound1);

  const [block, setBlock] = useState({ at: from, letters: seq0 });
  useEffect(() => {
    setBlock({ at: from, letters: seq0 });
    if (from === to && seq0 === seq1) return;
    const id = window.setTimeout(() => setBlock({ at: to, letters: seq1 }), 140);
    return () => window.clearTimeout(id);
  }, [from, to, seq0, seq1]);

  const testPos = direction === "left" ? (bound0 ?? 0) - 1 : (bound0 ?? 0);
  const testBase = win[testPos - windowStart] ?? "";
  const needed = direction === "left" ? seq0.slice(-1) : seq0.slice(0, 1);

  return (
    <div className="w">
      <div className="ruler-scroll">
        <Tape
          window={win}
          windowStart={windowStart}
          cellClass={(pos) => (pos === testPos ? "testing" : "")}
        >
          <span
            className="roll-block"
            style={{
              ...offset(block.at - windowStart),
              width: `calc(var(--cell) * ${len})`,
            }}
          >
            {block.letters.split("").map((char, i) => (
              <span key={i} className="roll-letter">
                {char}
              </span>
            ))}
          </span>
          {moved && bound0 !== null && (
            <span
              className="bound ghost"
              style={offset(bound0 - windowStart)}
              title="could also be written here"
            />
          )}
          {bound1 !== null && (
            <span className="bound" style={offset(bound1 - windowStart)} />
          )}
        </Tape>
      </div>

      <Hint>
        {moved ? (
          <>
            The base at cut <code>{testPos}</code> is{" "}
            <code>{testBase || "∅"}</code>, the same letter this block{" "}
            {direction === "left" ? "ends" : "starts"} with. So the block can
            slide {direction} one place and read {shown(seq1)} instead. Both
            spellings delete the same thing.
          </>
        ) : (
          <>
            The base at cut <code>{testPos}</code> is{" "}
            <code>{testBase || "∅"}</code>, not <code>{needed || "∅"}</code>. The
            repeat stops here, so the {direction} edge is cut{" "}
            <code>{bound1}</code>.
          </>
        )}
      </Hint>
    </div>
  );
}
