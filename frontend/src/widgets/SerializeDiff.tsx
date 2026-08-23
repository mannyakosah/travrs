import { useMemo, useState, type ReactNode } from "react";
import type { TraceData } from "../types";
import { Hint } from "./shared";

type Span = { key: string; from: number; to: number; value: string };

function topLevelSpans(json: string): Span[] {
  const spans: Span[] = [];
  if (json[0] !== "{") return spans;

  const endOfString = (at: number) => {
    let j = at + 1;
    while (j < json.length) {
      if (json[j] === "\\") {
        j += 2;
        continue;
      }
      if (json[j] === '"') return j + 1;
      j++;
    }
    return j;
  };

  const endOfValue = (at: number) => {
    const first = json[at];
    if (first === '"') return endOfString(at);
    if (first === "{" || first === "[") {
      let depth = 0;
      let j = at;
      while (j < json.length) {
        const char = json[j];
        if (char === '"') {
          j = endOfString(j);
          continue;
        }
        if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") {
          depth--;
          if (depth === 0) return j + 1;
        }
        j++;
      }
      return j;
    }
    let j = at;
    while (j < json.length && json[j] !== "," && json[j] !== "}") j++;
    return j;
  };

  let i = 1;
  while (i < json.length && json[i] !== "}") {
    if (json[i] !== '"') break;
    const keyEnd = endOfString(i);
    if (json[keyEnd] !== ":") break;
    const valueEnd = endOfValue(keyEnd + 1);
    spans.push({
      key: json.slice(i + 1, keyEnd - 1),
      from: i,
      to: valueEnd,
      value: json.slice(keyEnd + 1, valueEnd),
    });
    i = valueEnd;
    if (json[i] === ",") i++;
  }
  return spans;
}

function collectSpans(json: string, base = 0, prefix = ""): Map<string, Span> {
  const found = new Map<string, Span>();
  for (const span of topLevelSpans(json)) {
    const path = prefix ? `${prefix}.${span.key}` : span.key;
    found.set(path, { ...span, from: span.from + base, to: span.to + base });
    if (span.value.startsWith("{")) {
      const valueStart = span.to - span.value.length;
      for (const [key, nested] of collectSpans(
        span.value,
        base + valueStart,
        path,
      )) {
        found.set(key, nested);
      }
    }
  }
  return found;
}

function compact(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (value && typeof value === "object") {
    return Array.isArray(value) ? `[${value.length}]` : "{ … }";
  }
  return String(value);
}

type Row = {
  path: string;
  key: string;
  depth: number;
  value: unknown;
  status: "keeps" | "drops" | "digest";
};

function buildRows(
  source: Record<string, unknown>,
  spans: Map<string, Span>,
): Row[] {
  const rows: Row[] = [];
  for (const [key, value] of Object.entries(source)) {
    const span = spans.get(key);
    const nested = value !== null && typeof value === "object";
    const digested = !!span && nested && span.value.startsWith('"');
    rows.push({
      path: key,
      key,
      depth: 0,
      value,
      status: !span ? "drops" : digested ? "digest" : "keeps",
    });
    if (!span || digested || !nested || Array.isArray(value)) continue;
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const childPath = `${key}.${childKey}`;
      rows.push({
        path: childPath,
        key: childKey,
        depth: 1,
        value: childValue,
        status: spans.has(childPath) ? "keeps" : "drops",
      });
    }
  }
  return rows;
}

const WHY_DROPPED: Record<string, ReactNode> = {
  id: <>it is a convenience label, and it already contains the digest</>,
  digest: <>it is the answer itself, so hashing it would be circular</>,
  sequence: (
    <>
      those letters can be read back off the reference using the length and the
      subunit
    </>
  ),
};

export function SerializeDiff({
  data,
  onJump,
}: {
  data: TraceData;
  onJump?: (eventId: string) => void;
}) {
  const bytes = data.serialized ?? "";
  const spans = useMemo(() => collectSpans(bytes), [bytes]);
  const top = useMemo(() => topLevelSpans(bytes), [bytes]);
  const rows = useMemo(() => {
    try {
      return buildRows(
        JSON.parse(data.source_json ?? "{}") as Record<string, unknown>,
        spans,
      );
    } catch {
      return [] as Row[];
    }
  }, [data.source_json, spans]);

  const [active, setActive] = useState<string | null>(null);
  const activeRow = rows.find((row) => row.path === active);
  const activeSpan = active ? spans.get(active) : undefined;

  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const span of top) {
    if (span.from > cursor) {
      pieces.push(<span key={`sep${cursor}`}>{bytes.slice(cursor, span.from)}</span>);
    }
    const inner =
      activeSpan && activeSpan.from >= span.from && activeSpan.to <= span.to
        ? activeSpan
        : null;
    const partial = !!inner && (inner.from > span.from || inner.to < span.to);
    pieces.push(
      <span
        key={span.key}
        className={"byte-span" + (inner ? " on" : "")}
        onMouseEnter={() => setActive(span.key)}
        onMouseLeave={() => setActive(null)}
      >
        {partial && inner ? (
          <>
            {bytes.slice(span.from, inner.from)}
            <mark className="byte-mark">
              {bytes.slice(inner.from, inner.to)}
            </mark>
            {bytes.slice(inner.to, span.to)}
          </>
        ) : (
          bytes.slice(span.from, span.to)
        )}
      </span>,
    );
    cursor = span.to;
  }
  if (cursor < bytes.length) {
    pieces.push(<span key="tail">{bytes.slice(cursor)}</span>);
  }

  const digested = rows.find((row) => row.status === "digest");

  return (
    <div className="w">
      <div className="diff">
        <div className="diff-pane">
          <div className="pane-label">the object</div>
          <ul className="key-list">
            {rows.map((row) => (
              <li
                key={row.path}
                className={
                  row.status +
                  (row.depth ? " child" : "") +
                  (active === row.path ? " on" : "")
                }
                onMouseEnter={() => setActive(row.path)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="key-name">{row.key}</span>
                <span className="key-value">{compact(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="diff-pane">
          <div className="pane-label">the bytes that get hashed</div>
          <pre className="byte-block">{pieces}</pre>
          {digested && onJump && (
            <button
              type="button"
              className="jump"
              onClick={() => onJump("D1a")}
              onMouseEnter={() => setActive(digested.path)}
              onMouseLeave={() => setActive(null)}
            >
              that {digested.key} digest came from step D1 →
            </button>
          )}
        </div>
      </div>

      <Hint>
        {!activeRow ? (
          <>
            Left is the object in memory. Right is the exact byte string that
            gets hashed. Hover a key to see where it went.
          </>
        ) : activeRow.status === "digest" ? (
          <>
            <code>{activeRow.key}</code> is identifiable on its own, so the bytes
            carry its digest instead of the whole nested object. That is the
            recursion: an Allele leans on its location's identity, which leans on
            the sequence digest.
          </>
        ) : activeRow.status === "keeps" ? (
          <>
            <code>{activeRow.key}</code> is inherent to what this object{" "}
            <em>is</em>, so it is part of the hash. Change it and you have a
            different variant with a different ID.
          </>
        ) : (
          <>
            <code>{activeRow.key}</code> never reaches the hash
            {WHY_DROPPED[activeRow.key] ? (
              <> because {WHY_DROPPED[activeRow.key]}</>
            ) : null}
            . Two objects that differ only here still get the same ID.
          </>
        )}
      </Hint>
    </div>
  );
}
