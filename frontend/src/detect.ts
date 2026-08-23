import type { DetectedFormat } from "./types";

const SPDI = /^[^:\s]+:\d+:[A-Za-z0-9]*:[A-Za-z0-9]*$/;
const GNOMAD = /^[A-Za-z0-9_.]+-\d+-[ACGTURYKMSWBDHVN]+-[ACGTURYKMSWBDHVN]+$/i;
const HGVS = /^[A-Za-z][A-Za-z0-9_.]+(?:\([^)]+\))?:[gcnpmr]\..+$/;
const VRS_ID = /^ga4gh:(VA|SL|SQ|CC|CX|CN)\.[A-Za-z0-9_-]+$/;
const RSID = /^rs\d+$/i;
const CA = /^CA\d+$/i;
const CLINVAR = /^(?:VCV|RCV|SCV)/i;

export function detectFormat(raw: string): DetectedFormat {
  const text = raw.trim();
  if (!text) return "unknown";
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text) as { type?: string };
      if (obj && typeof obj === "object" && obj.type) return "vrs";
    } catch {
      return "unknown";
    }
    return "unknown";
  }
  if (VRS_ID.test(text)) return "vrs_id";
  if (SPDI.test(text)) return "spdi";
  if (GNOMAD.test(text)) return "gnomad";
  if (HGVS.test(text)) return "hgvs";
  if (RSID.test(text)) return "rsid";
  if (CA.test(text)) return "clingen_ca";
  if (CLINVAR.test(text)) return "clinvar";
  return "unknown";
}

export function formatLabel(fmt: DetectedFormat | string): string {
  const labels: Record<string, string> = {
    hgvs: "HGVS",
    spdi: "SPDI",
    gnomad: "GNOMAD",
    vrs: "VRS",
    vrs_id: "VRS ID",
    clinvar: "CLINVAR",
    rsid: "RSID",
    clingen_ca: "CLINGEN",
    unknown: "·",
  };
  return labels[fmt] ?? fmt.toUpperCase();
}
