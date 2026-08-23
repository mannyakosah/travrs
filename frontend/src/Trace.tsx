import { useEffect, useMemo, useState } from "react";
import type { Check, TraceEvent, TraceGroup, TraceRuler } from "./types";
import "./Trace.css";

const GROUPS: { key: TraceGroup; letter: string; title: string }[] = [
  { key: "resolve", letter: "A", title: "Sequence resolution" },
  { key: "coordinates", letter: "B", title: "Inter-residue coordinates" },
  { key: "normalize", letter: "C", title: "Normalization (VOCA + RLE)" },
  { key: "digest", letter: "D", title: "Computed identifier" },
];

export const JOURNEY: { key: string; label: string; check?: string }[] = [
  { key: "detect", label: "Detect" },
  { key: "translate", label: "Translate", check: "translate" },
  { key: "identify", label: "Identify", check: "computed_id" },
  { key: "verify", label: "Verify ref", check: "reference_fetch" },
  { key: "equivalents", label: "Equivalents" },
];

export function JourneyBar({
  current,
  completed,
  failed,
}: {
  current?: string | null;
  completed: ReadonlySet<string>;
  failed?: ReadonlySet<string>;
}) {
  return (
    <div className="pipeline" aria-live="polite">
      {JOURNEY.map((node, i) => {
        const isFailed = failed?.has(node.key);
        const isDone = completed.has(node.key);
        const isCurrent = current === node.key && !isDone;
        const cls =
          "pipeline-node" +
          (isFailed ? " failed" : isDone ? " done" : isCurrent ? " current" : "");
        return (
          <span key={node.key} className="pipeline-node-wrap">
            {i > 0 && <span className="pipeline-link" />}
            <span className={cls}>{node.label}</span>
          </span>
        );
      })}
    </div>
  );
}

type Mode = "learn" | "spec";

function fmtValue(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "string") return value === "" ? "''" : `'${value}'`;
  return String(value);
}

function StatePairs({ obj }: { obj: Record<string, unknown> }) {
  return (
    <span className="pairs">
      {Object.entries(obj).map(([k, v]) => (
        <span key={k} className="pair">
          <span className="pair-key">{k}</span> {fmtValue(v)}
        </span>
      ))}
    </span>
  );
}

function tickClass(value: number, which: "start" | "end"): string {
  const long = String(value).length >= 6 ? " long" : "";
  return `tick-label tick-${which}${long}`;
}

function Ruler({ ruler }: { ruler: TraceRuler }) {
  const cells = ruler.window.split("");
  const endTickAfter = ruler.window_start + cells.length === ruler.end;
  return (
    <div className="ruler" aria-label={`interval [${ruler.start}, ${ruler.end})`}>
      <div className="ruler-row">
        {cells.map((base, i) => {
          const pos = ruler.window_start + i;
          const inIval = pos >= ruler.start && pos < ruler.end;
          const isStart = pos === ruler.start;
          const isEnd = pos === ruler.end;
          return (
            <span
              key={i}
              className={
                "ruler-cell" +
                (inIval ? " in" : "") +
                (isStart || isEnd ? " tick" : "")
              }
            >
              {isStart && (
                <span className={tickClass(ruler.start, "start")}>{ruler.start}</span>
              )}
              {isEnd && <span className={tickClass(ruler.end, "end")}>{ruler.end}</span>}
              {base}
            </span>
          );
        })}
        {endTickAfter && (
          <span className="ruler-cell tick phantom">
            <span className={tickClass(ruler.end, "end")}>{ruler.end}</span>
          </span>
        )}
      </div>
      <div className="ruler-caption">
        [{ruler.start}, {ruler.end})
      </div>
    </div>
  );
}

function HexCut({ full, keptHex }: { full: string; keptHex: string }) {
  return (
    <div className="hex-cut">
      <span className="kept">{keptHex}</span>
      <span className="cut">{full.slice(keptHex.length)}</span>
    </div>
  );
}

function DigestData({ data }: { data: Record<string, string> }) {
  return (
    <div className="digest-data">
      {data.serialized && (
        <div>
          <div className="data-label">canonical serialization (the exact hashed bytes)</div>
          <pre className="bytes">{data.serialized}</pre>
        </div>
      )}
      {data.sha512_hex && (
        <div>
          <div className="data-label">sha-512 → keep 24 bytes → base64url</div>
          <HexCut full={data.sha512_hex} keptHex={data.truncated_hex ?? ""} />
          <div className="b64">{data.base64url}</div>
        </div>
      )}
      {data.digest && (
        <div className="id-assembly">
          <span className="seg ns">{data.namespace}</span>
          <span className="seg sep">:</span>
          <span className="seg type">{data.type_prefix}</span>
          <span className="seg sep">.</span>
          <span className="seg digest">{data.digest}</span>
        </div>
      )}
    </div>
  );
}

function Frame({ event, mode }: { event: TraceEvent; mode: Mode }) {
  return (
    <div className="frame">
      <div className="frame-title">
        <span className="frame-id">{event.id}</span>
        {event.title}
      </div>
      {event.ruler && <Ruler ruler={event.ruler} />}
      {event.note && <p className="frame-note">{event.note}</p>}
      {(event.before || event.after) && (
        <div className="frame-states">
          {event.before && (
            <div>
              <span className="state-label">before</span>
              <StatePairs obj={event.before} />
            </div>
          )}
          {event.after && (
            <div>
              <span className="state-label">after</span>
              <StatePairs obj={event.after} />
            </div>
          )}
        </div>
      )}
      {mode === "spec" && event.data && <DigestData data={event.data} />}
      {(event.refs.length > 0 || event.glossary) && (
        <div className="frame-refs">
          {event.refs
            .filter((ref) => ref.kind !== "paper")
            .map((ref) => (
              <a key={ref.url + ref.label} href={ref.url} target="_blank" rel="noreferrer">
                {ref.kind}: {ref.label}
              </a>
            ))}
          {event.glossary && (
            <a href={`/glossary#${event.glossary}`}>glossary: {event.glossary}</a>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  letter,
  title,
  events,
  mode,
  defaultOpen,
}: {
  letter: string;
  title: string;
  events: TraceEvent[];
  mode: Mode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [events]);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  const summary = useMemo(() => {
    const last = [...events].reverse().find((e) => e.after);
    if (!last?.after) return events[events.length - 1]?.title ?? "";
    return Object.entries(last.after)
      .slice(0, 4)
      .map(([k, v]) => `${k} ${fmtValue(v)}`)
      .join(" · ");
  }, [events]);

  const current = events[Math.min(idx, events.length - 1)];

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      setIdx((v) => Math.min(v + 1, events.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      setIdx((v) => Math.max(v - 1, 0));
      e.preventDefault();
    }
  }

  return (
    <div className={"group-card" + (open ? " open" : "")}>
      <button type="button" className="group-head" onClick={() => setOpen(!open)}>
        <span className="group-letter">{letter}</span>
        <span className="group-title">{title}</span>
        <span className="group-summary">{summary}</span>
        <span className="group-toggle">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="group-body" tabIndex={0} onKeyDown={onKey}>
          <Frame event={current} mode={mode} />
          {events.length > 1 && (
            <div className="stepper">
              <button
                type="button"
                onClick={() => setIdx((v) => Math.max(v - 1, 0))}
                disabled={idx === 0}
              >
                ← prev
              </button>
              <span className="stepper-pos">
                {idx + 1} / {events.length}
              </span>
              <button
                type="button"
                onClick={() => setIdx((v) => Math.min(v + 1, events.length - 1))}
                disabled={idx === events.length - 1}
              >
                next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Trace({
  events,
  verified,
  checks,
}: {
  events: TraceEvent[];
  verified: boolean | null;
  checks: Check[];
}) {
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem("travrs-trace-mode") as Mode) || "learn",
  );
  useEffect(() => localStorage.setItem("travrs-trace-mode", mode), [mode]);

  const byGroup = useMemo(() => {
    const map = new Map<TraceGroup, TraceEvent[]>();
    for (const event of events) {
      if (event.step === "verify" && verified !== false) continue;
      const list = map.get(event.group) ?? [];
      list.push(event);
      map.set(event.group, list);
    }
    return map;
  }, [events, verified]);

  const completed = useMemo(() => {
    const done = new Set<string>(["detect", "equivalents"]);
    if (checks.some((c) => c.name === "translate")) done.add("translate");
    if (checks.some((c) => c.name === "computed_id")) done.add("identify");
    if (checks.some((c) => c.name === "reference_fetch")) done.add("verify");
    return done;
  }, [checks]);

  const failed = useMemo(() => {
    const bad = new Set<string>();
    if (checks.some((c) => c.name === "translate" && !c.ok)) bad.add("translate");
    if (checks.some((c) => c.name === "computed_id" && !c.ok)) bad.add("identify");
    if (checks.some((c) => c.name === "reference_fetch" && !c.ok)) bad.add("verify");
    return bad;
  }, [checks]);

  return (
    <section className="trace">
      <div className="trace-head">
        <p className="section-label">Trace</p>
        <div className="trace-controls">
          {verified === false && (
            <span className="verified bad">
              This step view disagrees with vrs-python. The identifier above is the library’s.
            </span>
          )}
          <div className="mode-switch" role="group" aria-label="trace detail level">
            {(["learn", "spec"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "active" : ""}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <JourneyBar completed={completed} failed={failed} />

      {GROUPS.filter((g) => byGroup.has(g.key)).map((g) => (
        <GroupCard
          key={g.key}
          letter={g.letter}
          title={g.title}
          events={byGroup.get(g.key)!}
          mode={mode}
          defaultOpen={mode === "spec" || g.key === "normalize"}
        />
      ))}
    </section>
  );
}
