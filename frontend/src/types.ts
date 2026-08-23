export type DetectedFormat =
  | "hgvs"
  | "spdi"
  | "gnomad"
  | "vrs"
  | "vrs_id"
  | "clinvar"
  | "rsid"
  | "clingen_ca"
  | "unknown";

export type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

export type TraceRef = {
  kind: "spec" | "code" | string;
  label: string;
  url: string;
};

export type TraceRuler = {
  window: string;
  window_start: number;
  start: number;
  end: number;
};

export type TraceGroup = "resolve" | "coordinates" | "normalize" | "digest";

export type TraceEvent = {
  id: string;
  group: TraceGroup;
  step: string;
  iteration: number | null;
  title: string;
  note: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ruler: TraceRuler | null;
  refs: TraceRef[];
  glossary: string | null;
  data: Record<string, string> | null;
};

export type InspectResponse = {
  input: string;
  detected_format: string;
  detection_note: string;
  provenance: string[];
  id: string | null;
  location_id: string | null;
  allele: Record<string, unknown> | null;
  equivalents: Record<string, string[]>;
  checks: Check[];
  reference_at_location: string | null;
  trace: TraceEvent[];
  trace_verified: boolean | null;
  errors: string[];
  versions: Record<string, string>;
  cached?: boolean;
};
