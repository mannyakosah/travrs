import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { JourneyStage } from "./api";
import { formatLabel } from "./detect";
import type { Check, TraceEvent, TraceGroup } from "./types";
import {
  AccessionFunnel,
  ExpandBrackets,
  HashFunnel,
  IdAssembly,
  IntervalRuler,
  RollStage,
  SerializeDiff,
  StateChip,
  TrimTapes,
} from "./widgets";
import "./Trace.css";

export const JOURNEY: { key: JourneyStage; label: string; subtitle: string }[] = [
  { key: "detect", label: "Detect", subtitle: "what did you paste?" },
  { key: "resolve", label: "Resolve", subtitle: "which exact sequence?" },
  { key: "coordinates", label: "Coordinates", subtitle: "count the gaps" },
  { key: "normalize", label: "Normalize", subtitle: "one canonical form" },
  { key: "identify", label: "Identify", subtitle: "hash → identity" },
  { key: "verify", label: "Verify", subtitle: "double-check the bases" },
  { key: "equivalents", label: "Equivalents", subtitle: "other spellings" },
];

const ALG: Record<string, { group: TraceGroup; letter: string; title: string }> = {
  resolve: { group: "resolve", letter: "A", title: "Sequence resolution" },
  coordinates: { group: "coordinates", letter: "B", title: "Inter-residue coordinates" },
  normalize: { group: "normalize", letter: "C", title: "Normalization (VOCA + RLE)" },
  identify: { group: "digest", letter: "D", title: "Computed identifier" },
};

export function JourneyBar({
  current,
  completed,
  failed,
  selected,
  onSelect,
}: {
  current?: string | null;
  completed: ReadonlySet<string>;
  failed?: ReadonlySet<string>;
  selected?: string | null;
  onSelect?: (key: JourneyStage) => void;
}) {
  return (
    <div className="pipeline" aria-live="polite">
      {JOURNEY.map((node, i) => {
        const isFailed = failed?.has(node.key);
        const isDone = completed.has(node.key);
        const isCurrent = current === node.key && !isDone;
        const isSelected = selected === node.key;
        const cls =
          "pipeline-node" +
          (isFailed ? " failed" : isDone ? " done" : isCurrent ? " current" : "") +
          (isSelected ? " selected" : "");
        const inner = (
          <>
            <span className="pipeline-label">{node.label}</span>
            <span className="pipeline-sub">{node.subtitle}</span>
          </>
        );
        return (
          <span key={node.key} className="pipeline-node-wrap">
            {i > 0 && <span className="pipeline-link" aria-hidden />}
            {onSelect ? (
              <button
                type="button"
                className={cls}
                onClick={() => onSelect(node.key)}
                aria-current={isSelected || isCurrent ? "step" : undefined}
              >
                {inner}
              </button>
            ) : (
              <span className={cls}>{inner}</span>
            )}
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

function readText(bag: Record<string, unknown> | null, key: string): string {
  const value = bag?.[key];
  return typeof value === "string" ? value : "";
}

function stepWidget(
  event: TraceEvent,
  onJump: (eventId: string) => void,
): ReactNode | null {
  const { before, after, ruler, data } = event;
  switch (event.step) {
    case "sequence_digest":
      return (
        <AccessionFunnel
          pasted={readText(before, "accession")}
          digest={readText(after, "refgetAccession")}
          data={data}
        />
      );
    case "inter_residue":
      return ruler ? <IntervalRuler ruler={ruler} interactive /> : null;
    case "operands":
      return <TrimTapes before={before} after={null} side={null} />;
    case "trim_suffix":
      return <TrimTapes before={before} after={after} side="suffix" />;
    case "trim_prefix":
      return <TrimTapes before={before} after={after} side="prefix" />;
    case "left_roll":
    case "right_roll":
      return ruler ? (
        <RollStage
          ruler={ruler}
          before={before}
          after={after}
          direction={event.step === "left_roll" ? "left" : "right"}
        />
      ) : null;
    case "expand":
      return ruler ? (
        <ExpandBrackets ruler={ruler} before={before} after={after} />
      ) : null;
    case "encode_state":
      return <StateChip after={after} ruler={ruler} />;
    case "classify":
      return after && "state_type" in after ? (
        <StateChip after={after} ruler={ruler} />
      ) : null;
    case "serialize":
      return data ? <SerializeDiff data={data} onJump={onJump} /> : null;
    case "hash":
      return data ? <HashFunnel data={data} /> : null;
    case "prefix":
      return data ? <IdAssembly data={data} /> : null;
    default:
      return null;
  }
}

function Frame({
  event,
  mode,
  onJump,
}: {
  event: TraceEvent;
  mode: Mode;
  onJump: (eventId: string) => void;
}) {
  const widget = stepWidget(event, onJump);
  return (
    <div className="frame">
      <div className="frame-title">
        <span className="frame-id">{event.id}</span>
        {event.title}
      </div>
      {event.note && <p className="frame-note">{event.note}</p>}
      {widget ?? (event.ruler && <IntervalRuler ruler={event.ruler} />)}
      {(mode === "spec" || !widget) && (event.before || event.after) && (
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

function ThinCard({
  id,
  title,
  summary,
  defaultOpen,
  focusKey,
  focusAt,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  defaultOpen: boolean;
  focusKey: string | null;
  focusAt: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  useEffect(() => {
    if (focusKey === id) setOpen(true);
  }, [focusKey, focusAt, id]);

  return (
    <div id={`journey-${id}`} className={"group-card thin" + (open ? " open" : "")}>
      <button type="button" className="group-head" onClick={() => setOpen(!open)}>
        <span className="group-title">{title}</span>
        <span className="group-summary">{summary}</span>
        <span className="group-toggle">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="group-body">{children}</div>}
    </div>
  );
}

function GroupCard({
  cardKey,
  letter,
  title,
  events,
  mode,
  defaultOpen,
  focusKey,
  focusAt,
}: {
  cardKey: string;
  letter: string;
  title: string;
  events: TraceEvent[];
  mode: Mode;
  defaultOpen: boolean;
  focusKey: string | null;
  focusAt: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setIdx(0), [events]);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  useEffect(() => {
    if (focusKey === cardKey) setOpen(true);
  }, [focusKey, focusAt, cardKey]);

  useEffect(() => {
    if (!playing) return;
    if (idx >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIdx((v) => v + 1), 1100);
    return () => window.clearTimeout(id);
  }, [playing, idx, events.length]);

  function step(delta: number) {
    setPlaying(false);
    setIdx((v) => Math.min(Math.max(v + delta, 0), events.length - 1));
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (idx >= events.length - 1) setIdx(0);
    setPlaying(true);
  }

  function jump(eventId: string) {
    const target = events.findIndex((event) => event.id === eventId);
    if (target >= 0) {
      setPlaying(false);
      setIdx(target);
    }
  }

  const summary = useMemo(() => {
    const last = [...events].reverse().find((e) => e.after);
    if (!last?.after) return events[events.length - 1]?.title ?? "";
    return Object.entries(last.after)
      .slice(0, 4)
      .map(([k, v]) => `${k} ${fmtValue(v)}`)
      .join(" · ");
  }, [events]);

  const current = events[Math.min(idx, events.length - 1)];

  function onKey(e: { key: string; preventDefault(): void }) {
    if (e.key === "ArrowRight") {
      step(1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      step(-1);
      e.preventDefault();
    }
  }

  return (
    <div id={`journey-${cardKey}`} className={"group-card" + (open ? " open" : "")}>
      <button type="button" className="group-head" onClick={() => setOpen(!open)}>
        <span className="group-letter">{letter}</span>
        <span className="group-title">{title}</span>
        <span className="group-summary">{summary}</span>
        <span className="group-toggle">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="group-body" tabIndex={0} onKeyDown={onKey}>
          <Frame event={current} mode={mode} onJump={jump} />
          {events.length > 1 && (
            <div className="stepper">
              <button type="button" onClick={() => step(-1)} disabled={idx === 0}>
                ← prev
              </button>
              <span className="stepper-pos">
                {idx + 1} / {events.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={idx === events.length - 1}
              >
                next →
              </button>
              <button
                type="button"
                className={"play" + (playing ? " on" : "")}
                onClick={togglePlay}
                aria-label={playing ? "pause" : "play all steps"}
              >
                {playing ? "❙❙ pause" : "▶ play"}
              </button>
              <span className="stepper-dots" aria-hidden>
                {events.map((event, i) => (
                  <button
                    key={event.id}
                    type="button"
                    className={"dot" + (i === idx ? " on" : "")}
                    onClick={() => {
                      setPlaying(false);
                      setIdx(i);
                    }}
                    title={`${event.id} ${event.title}`}
                  />
                ))}
              </span>
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
  detectedFormat,
  detectionNote,
  reference,
  equivalents,
}: {
  events: TraceEvent[];
  verified: boolean | null;
  checks: Check[];
  detectedFormat: string;
  detectionNote: string;
  reference: string | null;
  equivalents: Record<string, string[]>;
}) {
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem("travrs-trace-mode") as Mode) || "learn",
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [focusAt, setFocusAt] = useState(0);
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

  const failed = useMemo(() => {
    const bad = new Set<JourneyStage>();
    if (checks.some((c) => c.name === "translate" && !c.ok)) {
      bad.add("resolve");
      bad.add("coordinates");
      bad.add("normalize");
    }
    if (checks.some((c) => c.name === "computed_id" && !c.ok)) bad.add("identify");
    if (
      checks.some(
        (c) =>
          (c.name === "reference_fetch" || c.name === "asserted_reference") && !c.ok,
      )
    ) {
      bad.add("verify");
    }
    return bad;
  }, [checks]);

  const completed = useMemo(() => {
    const done = new Set<JourneyStage>(JOURNEY.map((node) => node.key));
    for (const key of failed) done.delete(key);
    return done;
  }, [failed]);

  function selectStage(key: JourneyStage) {
    setFocusKey(key);
    setFocusAt(Date.now());
    window.requestAnimationFrame(() => {
      document.getElementById(`journey-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const verifyChecks = checks.filter(
    (c) => c.name === "reference_fetch" || c.name === "asserted_reference",
  );
  const firstEquivalent =
    equivalents.hgvs?.[0] ?? equivalents.spdi?.[0] ?? "none";

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

      <JourneyBar
        completed={completed}
        failed={failed}
        selected={focusKey}
        onSelect={selectStage}
      />

      {JOURNEY.map((node) => {
        if (node.key === "detect") {
          return (
            <ThinCard
              key={node.key}
              id={node.key}
              title="Detect"
              summary={formatLabel(detectedFormat)}
              defaultOpen={mode === "spec"}
              focusKey={focusKey}
              focusAt={focusAt}
            >
              <p className="thin-line">
                <span className="pair-key">{formatLabel(detectedFormat)}</span>{" "}
                {detectionNote || "format detected"}
              </p>
            </ThinCard>
          );
        }
        if (node.key === "verify") {
          return (
            <ThinCard
              key={node.key}
              id={node.key}
              title="Verify"
              summary={reference != null ? `'${reference}'` : "no bases"}
              defaultOpen={mode === "spec" || failed.has("verify")}
              focusKey={focusKey}
              focusAt={focusAt}
            >
              {reference != null && (
                <p className="thin-line">
                  <span className="pair-key">reference</span> {reference === "" ? "∅" : `'${reference}'`}
                </p>
              )}
              {verifyChecks.map((check) => (
                <p key={check.name} className={"thin-line" + (check.ok ? "" : " bad")}>
                  {check.detail}
                </p>
              ))}
            </ThinCard>
          );
        }
        if (node.key === "equivalents") {
          return (
            <ThinCard
              key={node.key}
              id={node.key}
              title="Equivalents"
              summary={firstEquivalent}
              defaultOpen={mode === "spec"}
              focusKey={focusKey}
              focusAt={focusAt}
            >
              {Object.entries(equivalents).map(([fmt, values]) => (
                <p key={fmt} className="thin-line">
                  <span className="pair-key">{fmt.toUpperCase()}</span>{" "}
                  {values.slice(0, 3).join(" · ")}
                  {values.length > 3 ? ` +${values.length - 3}` : ""}
                </p>
              ))}
            </ThinCard>
          );
        }

        const alg = ALG[node.key];
        const groupEvents = byGroup.get(alg.group);
        if (!groupEvents?.length) return null;
        return (
          <GroupCard
            key={node.key}
            cardKey={node.key}
            letter={alg.letter}
            title={alg.title}
            events={groupEvents}
            mode={mode}
            defaultOpen={mode === "spec" || alg.group === "normalize"}
            focusKey={focusKey}
            focusAt={focusAt}
          />
        );
      })}
    </section>
  );
}
