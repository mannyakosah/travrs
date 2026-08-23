import { useState, type ReactNode } from "react";
import type { TraceData } from "../types";
import { Hint } from "./shared";

const LEGEND: Record<string, ReactNode> = {
  ns: (
    <>
      <code>ga4gh</code> marks this as a GA4GH computed identifier rather than an
      accession someone handed out.
    </>
  ),
  type: (
    <>
      The type prefix says what was hashed. <code>VA</code> is a variation
      allele, <code>SL</code> a sequence location, <code>SQ</code> a sequence. Two
      different types can never collide.
    </>
  ),
  digest: (
    <>
      The digest of this object's canonical bytes. Anyone who builds the same
      Allele computes this same string, which is why no central registry is
      needed.
    </>
  ),
};

export function IdAssembly({ data }: { data: TraceData }) {
  const [segment, setSegment] = useState<string | null>(null);

  return (
    <div className="w">
      <div className="id-build">
        <button
          type="button"
          className={"seg ns" + (segment === "ns" ? " on" : "")}
          onClick={() => setSegment(segment === "ns" ? null : "ns")}
        >
          {data.namespace}
        </button>
        <span className="seg-sep">:</span>
        <button
          type="button"
          className={"seg type" + (segment === "type" ? " on" : "")}
          onClick={() => setSegment(segment === "type" ? null : "type")}
        >
          {data.type_prefix}
        </button>
        <span className="seg-sep">.</span>
        <button
          type="button"
          className={"seg digest" + (segment === "digest" ? " on" : "")}
          onClick={() => setSegment(segment === "digest" ? null : "digest")}
        >
          {data.digest}
        </button>
      </div>

      <Hint>
        {segment ? LEGEND[segment] : <>Click a piece of the identifier.</>}
      </Hint>
    </div>
  );
}
