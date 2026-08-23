import type { CSSProperties, ReactNode } from "react";
import type { TraceRuler } from "../types";

export type Bag = Record<string, unknown> | null;
export type Edge = "gap" | "base";

export function num(bag: Bag, key: string): number | null {
  const value = bag?.[key];
  return typeof value === "number" ? value : null;
}

export function text(bag: Bag, key: string): string | null {
  const value = bag?.[key];
  return typeof value === "string" ? value : null;
}

export function chunk(seq: string, size: number): string[] {
  if (size <= 0) return [seq];
  const out: string[] = [];
  for (let i = 0; i < seq.length; i += size) out.push(seq.slice(i, i + size));
  return out;
}

export function shown(seq: string): string {
  return seq === "" ? "∅" : `'${seq}'`;
}

export function offset(cells: number): CSSProperties {
  return { left: `calc(var(--cell) * ${cells})` };
}

export function refSlice(ruler: TraceRuler | null): string {
  if (!ruler) return "";
  const from = ruler.start - ruler.window_start;
  const to = ruler.end - ruler.window_start;
  if (from < 0 || to > ruler.window.length || to < from) return "";
  return ruler.window.slice(from, to);
}

export function classify(ref: string, alt: string): string {
  if (ref === alt) return "reference agreement";
  if (!alt) return "deletion";
  if (!ref) return "insertion";
  if (ref.length === 1 && alt.length === 1) return "substitution";
  return "delins";
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="w-hint" aria-live="polite">
      {children}
    </p>
  );
}

export function Tape({
  window: win,
  windowStart,
  cellClass,
  onCell,
  onLeave,
  children,
}: {
  window: string;
  windowStart: number;
  cellClass?: (pos: number) => string;
  onCell?: (pos: number, edge: Edge) => void;
  onLeave?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="tape" onMouseLeave={onLeave}>
      <div className="tape-row">
        {win.split("").map((char, i) => {
          const pos = windowStart + i;
          return (
            <span
              key={i}
              className={"tape-cell" + (cellClass ? ` ${cellClass(pos)}` : "")}
              onMouseMove={
                onCell
                  ? (event) => {
                      const width = event.currentTarget.clientWidth;
                      const x = event.nativeEvent.offsetX;
                      if (x <= 3) onCell(pos, "gap");
                      else if (x >= width - 3) onCell(pos + 1, "gap");
                      else onCell(pos, "base");
                    }
                  : undefined
              }
            >
              {char}
            </span>
          );
        })}
        {children}
      </div>
    </div>
  );
}

export function Bracket({
  start,
  end,
  windowStart,
  label,
  kind,
}: {
  start: number;
  end: number;
  windowStart: number;
  label: string;
  kind: "solid" | "ghost";
}) {
  const width = Math.max(end - start, 0);
  return (
    <span
      className={`tape-bracket ${kind}`}
      style={{
        ...offset(start - windowStart),
        width: `calc(var(--cell) * ${width})`,
      }}
    >
      <span className="bracket-label">{label}</span>
    </span>
  );
}
