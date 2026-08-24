import { useState } from "react";
import type { CatalogName, TraceData } from "../types";
import { Hint } from "./shared";

export function AccessionFunnel({
  pasted,
  digest,
  data,
}: {
  pasted: string;
  digest: string;
  data: TraceData | null;
}) {
  const rows: CatalogName[] = data?.catalog_names?.length
    ? data.catalog_names
    : [{ namespace: "you pasted", value: pasted }];
  const [hover, setHover] = useState<number | null>(null);
  const rowHeight = 30;
  const height = rows.length * rowHeight;
  const middle = height / 2;
  const length = data?.sequence_length;

  const hint =
    hover === null ? (
      <>
        {rows.length > 1
          ? `${rows.length} accessions, one molecule`
          : "One accession"}
        {length ? ` of ${length.toLocaleString()} bases` : ""}. Every name on the
        left resolves to the single digest on the right.
      </>
    ) : (
      <>
        <code>{rows[hover].value}</code> is an accession in the{" "}
        <code>{rows[hover].namespace}</code> catalog. Accessions never enter the
        hash, so another name for the same molecule still gives this ID.
      </>
    );

  return (
    <div className="w">
      <div className="funnel">
        <ul className="funnel-names">
          {rows.map((name, i) => (
            <li key={name.namespace + name.value}>
              <button
                type="button"
                className={"chip-name" + (hover === i ? " on" : "")}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
              >
                <span className="chip-ns">{name.namespace}</span>
                <span className="chip-val">{name.value}</span>
              </button>
            </li>
          ))}
        </ul>
        <svg
          className="funnel-wires"
          width="72"
          height={height}
          viewBox={`0 0 72 ${height}`}
          aria-hidden
        >
          {rows.map((name, i) => {
            const y = i * rowHeight + rowHeight / 2;
            return (
              <path
                key={name.namespace + name.value}
                className={"wire" + (hover === i ? " on" : "")}
                d={`M0 ${y} C 36 ${y}, 36 ${middle}, 72 ${middle}`}
              />
            );
          })}
        </svg>
        <div className="funnel-out">
          <span className="digest-pill">
            <span className="pill-ns">ga4gh:</span>
            {digest}
          </span>
          <span className="pill-note">the sequence's own digest</span>
        </div>
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}
