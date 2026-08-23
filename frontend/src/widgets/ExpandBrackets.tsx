import { Fragment, useMemo, useState } from "react";
import type { TraceRuler } from "../types";
import { Bracket, Hint, Tape, num, offset, type Bag } from "./shared";

export function ExpandBrackets({
  ruler,
  before,
  after,
}: {
  ruler: TraceRuler;
  before: Bag;
  after: Bag;
}) {
  const { window: win, window_start: windowStart } = ruler;
  const start0 = num(before, "start");
  const end0 = num(before, "end");
  const start1 = num(after, "start") ?? ruler.start;
  const end1 = num(after, "end") ?? ruler.end;
  const seed = start0 !== null && end0 !== null ? end0 - start0 : 0;
  const widened =
    start0 !== null && end0 !== null && (start1 < start0 || end1 > end0);

  const options = useMemo(
    () =>
      [
        {
          key: "left",
          label: "VCF · left",
          start: start1,
          end: Math.min(start1 + seed, end1),
          note: (
            <>
              A left-aligned caller writes it at the first spot that works. Fine
              on its own, impossible to match against a file that chose another
              spot.
            </>
          ),
        },
        {
          key: "three",
          label: "HGVS · 3′",
          start: Math.max(end1 - seed, start1),
          end: end1,
          note: (
            <>
              HGVS shifts as far 3′ as it can. Also reasonable, also a different
              set of numbers for the same molecule.
            </>
          ),
        },
        {
          key: "full",
          label: "VRS · whole region",
          start: start1,
          end: end1,
          note: (
            <>
              VRS refuses to pick. It states the entire stretch the change could
              sit in, so every caller lands on one answer. This interval is what
              the identifier hashes.
            </>
          ),
        },
      ] as const,
    [start1, end1, seed],
  );

  const [picked, setPicked] = useState<string>("full");
  const active = options.find((option) => option.key === picked) ?? options[2];

  if (!widened) {
    return (
      <div className="w">
        <div className="ruler-scroll brackets">
          <Tape window={win} windowStart={windowStart}>
            <Bracket
              start={start1}
              end={end1}
              windowStart={windowStart}
              label={`[${start1}, ${end1})`}
              kind="solid"
            />
          </Tape>
        </div>
        <Hint>
          No repeat around this change, so there is nothing to be ambiguous
          about. The interval stays where it started.
        </Hint>
      </div>
    );
  }

  return (
    <div className="w">
      <div className="lanes-scroll">
        <div className="lanes" role="group" aria-label="where to write the change">
          <span className="lane-head empty" />
          <div className="lane-tape">
            <Tape
              window={win}
              windowStart={windowStart}
              cellClass={(pos) =>
                pos >= active.start && pos < active.end ? "in" : ""
              }
            />
          </div>
          {options.map((option) => {
            const on = option.key === picked;
            return (
              <Fragment key={option.key}>
                <button
                  type="button"
                  className={"lane-head" + (on ? " on" : "")}
                  onClick={() => setPicked(option.key)}
                  aria-pressed={on}
                >
                  {option.label}
                </button>
                <div className={"lane" + (on ? " on" : "")}>
                  <span
                    className="lane-bar"
                    style={{
                      ...offset(option.start - windowStart),
                      width: `calc(var(--cell) * ${option.end - option.start})`,
                    }}
                  />
                  <span
                    className="lane-num"
                    style={offset(option.end - windowStart)}
                  >
                    [{option.start}, {option.end})
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <Hint>
        {active.note}
        {picked !== "full" && (
          <span className="warn-tag">not the VRS interval</span>
        )}
      </Hint>
    </div>
  );
}
