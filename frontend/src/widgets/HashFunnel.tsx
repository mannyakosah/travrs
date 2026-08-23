import { useState } from "react";
import type { TraceData } from "../types";
import { Hint } from "./shared";

export function HashFunnel({ data }: { data: TraceData }) {
  const hex = data.sha512_hex ?? "";
  const keptHex = data.truncated_hex ?? "";
  const b64 = data.base64url ?? "";
  const [zone, setZone] = useState<"kept" | "cut" | null>(null);

  return (
    <div className="w">
      <div className="hash">
        <div className="hash-line">
          <span className="hash-label">sha-512</span>
          <span className="hash-hex">
            <span
              className={"hex-kept" + (zone === "kept" ? " on" : "")}
              onMouseEnter={() => setZone("kept")}
              onMouseLeave={() => setZone(null)}
            >
              {keptHex}
            </span>
            <span
              className={"hex-cut" + (zone === "cut" ? " on" : "")}
              onMouseEnter={() => setZone("cut")}
              onMouseLeave={() => setZone(null)}
            >
              {hex.slice(keptHex.length)}
            </span>
          </span>
        </div>

        <div className="bars">
          <span className="bar full">sha-512 output · 64 bytes</span>
          <span className="bar kept">kept · 24</span>
        </div>

        <div className="hash-line">
          <span className="hash-label">base64url</span>
          <span className="hash-out">{b64}</span>
        </div>
      </div>

      <Hint>
        {zone === "cut" ? (
          <>
            These 40 bytes are thrown away. A shorter ID is easier to paste into
            a spreadsheet, and 24 bytes still leaves collisions out of reach.
          </>
        ) : zone === "kept" ? (
          <>
            The first 24 bytes survive, which is 192 bits, written as{" "}
            {b64.length} base64url characters.
          </>
        ) : (
          <>
            Same bytes in, same digest out, on any machine, with no registry to
            ask. Hover either half of the hash.
          </>
        )}
      </Hint>
    </div>
  );
}
