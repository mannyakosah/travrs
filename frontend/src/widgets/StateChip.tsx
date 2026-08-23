import { useState } from "react";
import type { TraceRuler } from "../types";
import { Hint, chunk, num, refSlice, text, type Bag } from "./shared";

export function StateChip({
  after,
  ruler,
}: {
  after: Bag;
  ruler: TraceRuler | null;
}) {
  const stateType = text(after, "state_type");
  const seq = text(after, "sequence") ?? "";
  const length = num(after, "length");
  const subunit = num(after, "repeatSubunitLength");
  const reference = refSlice(ruler);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = hovered || pinned;

  if (stateType !== "ReferenceLengthExpression") {
    return (
      <div className="w">
        <div className="rle">
          <div className="rle-row">
            <span className="rle-label">state</span>
            <span className="rle-literal">
              {seq === ""
                ? "∅"
                : seq.split("").map((char, i) => (
                    <span key={i} className="rle-cell">
                      {char}
                    </span>
                  ))}
            </span>
          </div>
        </div>
        <Hint>
          Stored letter for letter. For a short change that is the whole point:
          the letters <em>are</em> the state.
        </Hint>
      </div>
    );
  }

  const unit = subunit && subunit > 0 ? subunit : seq.length || 1;
  const copies = length !== null ? length / unit : null;
  const refCopies = reference ? reference.length / unit : null;
  const motif = seq.slice(0, unit) || reference.slice(0, unit);

  return (
    <div className="w">
      <div className="rle">
        {reference && (
          <div className="rle-row">
            <span className="rle-label">reference</span>
            <span className="rle-groups">
              {chunk(reference, unit).map((part, i) => (
                <span key={i} className="rle-unit">
                  {part}
                </span>
              ))}
            </span>
          </div>
        )}
        <div className="rle-row">
          <span className="rle-label">state</span>
          <button
            type="button"
            className={"rle-chip" + (expanded ? " open" : "")}
            onClick={() => setPinned(!pinned)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
          >
            {expanded ? (
              <span className="rle-groups">
                {chunk(seq || motif.repeat(Math.max(copies ?? 1, 1)), unit).map(
                  (part, i) => (
                    <span key={i} className="rle-unit">
                      {part}
                    </span>
                  ),
                )}
              </span>
            ) : (
              <span className="rle-compact">
                ⟨ <span className="rle-motif">{motif}</span> ×{" "}
                {copies ?? "?"} ⟩
              </span>
            )}
          </button>
        </div>
      </div>

      <Hint>
        {refCopies !== null && copies !== null ? (
          <>
            The region held {refCopies} cop{refCopies === 1 ? "y" : "ies"} of{" "}
            <code>{motif}</code>; the variant leaves {copies}. Storing{" "}
            <em>how many</em> instead of the letters is what keeps a
            10,000-base repeat from becoming a 10,000-character string.
          </>
        ) : (
          <>
            Length {length ?? "?"} built from a {unit}-letter subunit. The letters
            are derivable from the reference, so they are not part of the hash.
          </>
        )}
      </Hint>
    </div>
  );
}
