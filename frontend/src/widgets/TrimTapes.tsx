import { useEffect, useState } from "react";
import { Hint, classify, num, shown, text, type Bag } from "./shared";

function TrimRow({
  label,
  seq,
  trimmed,
  side,
}: {
  label: string;
  seq: string;
  trimmed: number;
  side: "prefix" | "suffix" | null;
}) {
  const letters = seq.split("");
  return (
    <div className="trim-row">
      <span className="trim-label">{label}</span>
      <span className="trim-tape">
        {letters.length === 0 && <span className="trim-empty">∅</span>}
        {letters.map((char, i) => {
          const cut =
            side === "suffix"
              ? i >= letters.length - trimmed
              : side === "prefix"
                ? i < trimmed
                : false;
          return (
            <span key={i} className={"trim-cell" + (cut ? " cut" : "")}>
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export function TrimTapes({
  before,
  after,
  side,
}: {
  before: Bag;
  after: Bag;
  side: "prefix" | "suffix" | null;
}) {
  const ref0 = text(before, "ref") ?? "";
  const alt0 = text(before, "alt") ?? "";
  const ref1 = after ? (text(after, "ref") ?? ref0) : ref0;
  const alt1 = after ? (text(after, "alt") ?? alt0) : alt0;
  const shared = Math.max(ref0.length - ref1.length, alt0.length - alt1.length, 0);

  const [trimmed, setTrimmed] = useState(shared);
  useEffect(() => setTrimmed(shared), [shared, ref0, alt0]);

  const keep = (seq: string) =>
    side === "suffix"
      ? seq.slice(0, seq.length - trimmed)
      : side === "prefix"
        ? seq.slice(trimmed)
        : seq;
  const refNow = keep(ref0);
  const altNow = keep(alt0);

  const start0 = num(before, "start");
  const end0 = num(before, "end");
  const startNow =
    start0 === null ? null : side === "prefix" ? start0 + trimmed : start0;
  const endNow = end0 === null ? null : side === "suffix" ? end0 - trimmed : end0;

  return (
    <div className="w">
      <div className="trim">
        <TrimRow label="reference" seq={ref0} trimmed={trimmed} side={side} />
        <TrimRow label="asserted" seq={alt0} trimmed={trimmed} side={side} />
      </div>

      <div className="trim-foot">
        <span className="badge-type">{classify(refNow, altNow)}</span>
        {startNow !== null && endNow !== null && (
          <span className="interval-caption">
            [{startNow}, {endNow})
          </span>
        )}
        {shared > 0 && (
          <label className="scrub">
            <span>un-trim</span>
            <input
              type="range"
              min={0}
              max={shared}
              value={trimmed}
              onChange={(event) => setTrimmed(Number(event.target.value))}
            />
          </label>
        )}
      </div>

      <Hint>
        {side === null ? (
          <>
            The reference reads {shown(ref0)} across this interval; the variant
            asserts {shown(alt0)}. Everything from here on is about writing that
            one change in exactly one way.
          </>
        ) : shared === 0 ? (
          <>
            Nothing is shared at {side === "prefix" ? "the front" : "the end"} of{" "}
            {shown(ref0)} and {shown(alt0)}, so the interval does not move.
          </>
        ) : trimmed === shared ? (
          <>
            {shared} shared {side === "prefix" ? "leading" : "trailing"} letter
            {shared === 1 ? "" : "s"} removed. Both sides still describe the same
            change, in fewer letters. Drag <em>un-trim</em> to put them back.
          </>
        ) : (
          <>
            Holding {shared - trimmed} shared letter
            {shared - trimmed === 1 ? "" : "s"} back. Padding the same change
            with reference letters is exactly what makes two files disagree
            about one variant.
          </>
        )}
      </Hint>
    </div>
  );
}
