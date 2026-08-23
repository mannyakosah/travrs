import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { TraceRuler } from "../types";
import { Hint, Tape, offset, type Edge } from "./shared";

export function IntervalRuler({
  ruler,
  interactive = false,
}: {
  ruler: TraceRuler;
  interactive?: boolean;
}) {
  const { window: win, window_start: windowStart, start, end } = ruler;
  const [hover, setHover] = useState<{ pos: number; edge: Edge } | null>(null);
  const [residues, setResidues] = useState(false);
  const span = end - start;
  const scroller = useRef<HTMLDivElement>(null);
  const cell = residues ? 26 : 15;

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const middle = (start - windowStart + span / 2) * cell;
    box.scrollTo({
      left: Math.max(0, middle - box.clientWidth / 2),
      behavior: "smooth",
    });
  }, [cell, start, windowStart, span]);

  function cellClass(pos: number): string {
    const inside = pos >= start && pos < end;
    const hovered = hover?.edge === "base" && hover.pos === pos;
    return [
      inside ? "in" : "",
      pos === start ? "tick-start" : "",
      pos === end ? "tick-end" : "",
      hovered ? "hovered" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const hint = hover ? (
    hover.edge === "gap" ? (
      <>
        Cut <code>{hover.pos}</code>. A position <em>between</em> letters.
        Counting these makes one interval mean the same thing for an insert, a
        delete, or a substitution.
      </>
    ) : (
      <>
        Letter <code>{win[hover.pos - windowStart]}</code> is residue{" "}
        <code>{hover.pos + 1}</code> when you count letters from 1. It sits
        between cut <code>{hover.pos}</code> and cut <code>{hover.pos + 1}</code>
        .
      </>
    )
  ) : residues ? (
    <>
      Counting letters, this is residue{" "}
      <code>
        {start + 1}
        {span > 1 ? `–${end}` : ""}
      </code>
      . Same stretch of molecule, different numbers. HGVS counts letters; VRS
      counts cuts.
      {end > 999 ? " Only the last three digits fit under a letter." : ""}
    </>
  ) : (
    <>
      Hover a letter, or the thin line between two letters. VRS numbers the
      lines, not the letters.
    </>
  );

  return (
    <div className="w">
      <div
        className="ruler-scroll"
        ref={scroller}
        style={{ "--cell": `${cell}px` } as CSSProperties}
      >
        <Tape
          window={win}
          windowStart={windowStart}
          cellClass={cellClass}
          onCell={
            interactive ? (pos, edge) => setHover({ pos, edge }) : undefined
          }
          onLeave={interactive ? () => setHover(null) : undefined}
        >
          <span className="tick-mark" style={offset(start - windowStart)}>
            <span className="tick-num above">{start}</span>
          </span>
          <span className="tick-mark" style={offset(end - windowStart)}>
            <span className="tick-num below">{end}</span>
          </span>
          {hover?.edge === "gap" && (
            <span
              className="tick-mark hover-cut"
              style={offset(hover.pos - windowStart)}
            />
          )}
          {residues &&
            Array.from({ length: span }, (_, i) => (
              <span
                key={i}
                className="residue-num"
                style={offset(start - windowStart + i)}
              >
                {(start + i + 1).toString().slice(-3)}
              </span>
            ))}
        </Tape>
      </div>

      <div className="ruler-foot">
        <span className="interval-caption">
          [{start}, {end})
          <span className="caption-note">
            {span === 0
              ? "one cut, nothing between it"
              : `${span} base${span === 1 ? "" : "s"} between two cuts`}
          </span>
        </span>
        {interactive && (
          <button
            type="button"
            className={"toggle" + (residues ? " on" : "")}
            onClick={() => setResidues(!residues)}
          >
            {residues ? "hide letter numbers" : "count letters instead"}
          </button>
        )}
      </div>

      {interactive && <Hint>{hint}</Hint>}
    </div>
  );
}
