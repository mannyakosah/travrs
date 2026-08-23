import { FormEvent, useMemo, useState } from "react";
import { inspectVariant } from "./api";
import { detectFormat, formatLabel } from "./detect";
import { EXAMPLES } from "./examples";
import Trace from "./Trace";
import type { InspectResponse } from "./types";
import "./App.css";

function explainFailure(result: InspectResponse): string {
  const joined = result.errors.join("\n");
  const note = result.detection_note + " " + joined;
  if (/intronic/i.test(note)) {
    return "This looks like an intronic or splice-site HGVS expression. A plain VRS Allele lives on one sequence; intron offsets are not bases on that transcript. VRS 2.1 RelativeAllele is the intended representation.";
  }
  if (/repeat notation|#582/i.test(note)) {
    return "HGVS repeat notation (the [N] form) is not translated yet. That is a known gap in vrs-python (ga4gh/vrs-python#582).";
  }
  if (/not implemented/i.test(joined) || /not implemented/i.test(result.detection_note)) {
    return "This identifier kind is recognized but not resolved yet. Paste HGVS, SPDI, gnomAD (chrom-pos-ref-alt), or VRS JSON.";
  }
  if (joined) return joined;
  return "Could not translate this input to a VRS Allele.";
}

export default function App() {
  const [input, setInput] = useState("NM_007294.4:c.68_69del");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InspectResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const liveFormat = useMemo(() => detectFormat(input), [input]);

  async function run(value: string) {
    const next = value.trim();
    if (!next) return;
    setInput(next);
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const payload = await inspectVariant(next);
      setResult(payload);
    } catch (err) {
      setResult(null);
      const message = err instanceof Error ? err.message : String(err);
      if (/failed to fetch|networkerror/i.test(message)) {
        setError(
          "The API is not reachable. In another terminal: cd backend && travrs-serve, then try again.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run(input);
  }

  async function copyId(id: string) {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const failed = result && !result.id && result.errors.length > 0;

  return (
    <div className="page">
      <header>
        <div className="wordmark">
          tra<span className="vrs">VRS</span>
        </div>
        <p className="subline">pronounced traverse</p>
        <p className="lede">
          Paste HGVS, SPDI, gnomAD/VCF, or VRS JSON. Official vrs-python
          normalizes it and returns a computed identifier.
        </p>
      </header>

      <form className="field" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="variant">
          Variant
        </label>
        <div className="field-row">
          <div className="field-input-wrap">
            <input
              id="variant"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="NM_007294.4:c.68_69del"
            />
            <span className="badge">{formatLabel(liveFormat)}</span>
          </div>
          <button className="submit" type="submit" disabled={loading || !input.trim()}>
            Inspect
          </button>
        </div>
      </form>

      <div className="chips">
        {EXAMPLES.map((example) => (
          <button
            key={example.value}
            type="button"
            className="chip"
            onClick={() => void run(example.value)}
          >
            {example.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="status">
          {result?.cached
            ? "Looking up…"
            : "Translating via vrs-python (SeqRepo + UTA)…"}
        </p>
      )}

      {error && (
        <div className="error">
          <h2>Could not reach an answer</h2>
          <p>{error}</p>
        </div>
      )}

      {failed && (
        <div className="error">
          <h2>Not a VRS Allele — yet</h2>
          <p>{explainFailure(result)}</p>
          {result.detection_note && <pre>{result.detection_note}</pre>}
        </div>
      )}

      {result?.id && (
        <section className="identity">
          <p className="section-label">Computed identifier</p>
          <div className="id-row">
            <div className="id-value">{result.id}</div>
            <button type="button" className="copy" onClick={() => void copyId(result.id!)}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {result.location_id && (
            <div className="location">location {result.location_id}</div>
          )}
          {result.cached && <div className="location">served from cache</div>}

          <ul className="checks">
            {result.checks.map((check) => (
              <li key={check.name + check.detail}>
                <span className={`mark ${check.ok ? "ok" : "bad"}`}>
                  {check.ok ? "✓" : "✗"}
                </span>
                <span className="name">{check.name}</span>
                <span className="detail">{check.detail}</span>
              </li>
            ))}
          </ul>

          {result.trace.length > 0 && (
            <Trace
              events={result.trace}
              verified={result.trace_verified}
              checks={result.checks}
            />
          )}

          {result.allele && (
            <details className="json-block">
              <summary>VRS Allele JSON</summary>
              <pre>{JSON.stringify(result.allele, null, 2)}</pre>
            </details>
          )}
        </section>
      )}

      <footer className="footer">
        {result?.versions
          ? `vrs-python ${result.versions.vrs_python ?? "?"}  ·  traVRS ${result.versions.travrs ?? "?"}`
          : "vrs-python via POST /api/inspect"}
      </footer>
    </div>
  );
}
