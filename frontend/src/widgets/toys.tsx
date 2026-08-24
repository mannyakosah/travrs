import { useState, type ReactNode } from "react";
import { Hint, Tape } from "./shared";

export const TOY_BRCA1_C = "NM_007294.4:c.68_69del";
export const TOY_BRCA1_G = "NC_000017.11:g.43124027_43124028del";
export const TOY_VA = "VA.0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD";
export const TOY_SQ_TX = "SQ.oR9jzdHf6J23TozeyuvTXtwlm6PpUHHl";
export const TOY_SQ_CHR = "SQ.dLZ15tNO1Ur0IcGjwc3Sdi_0A6Yf4zm7";

export const TOY_RULER = {
  window: "GCAGAGAGTG",
  window_start: 176,
  start: 178,
  end: 182,
};

export const TOY_EXPAND = {
  ruler: TOY_RULER,
  before: { start: 180, end: 182 },
  after: { start: 178, end: 182 },
};

export const TOY_ACCESSION = {
  pasted: "NC_000017.11",
  digest: TOY_SQ_CHR,
  data: {
    catalog_names: [
      { namespace: "refseq", value: "NC_000017.11" },
      { namespace: "GRCh38", value: "chr17" },
      { namespace: "GRCh38", value: "17" },
    ],
    sequence_length: 83_257_441,
  },
};

export const TOY_HASH = {
  sha512_hex:
    "d180e40aa52bce9980b3eac0156a6843463a80dc1b2163c3772ca1fb896ca3a49144d3470978175cf58d53f0e188680a769592ff42ad731170b6ca8806db6cec",
  truncated_hex: "d180e40aa52bce9980b3eac0156a6843463a80dc1b2163c3",
  base64url: "0YDkCqUrzpmAs-rAFWpoQ0Y6gNwbIWPD",
};

const BUILDS = {
  grch37: {
    label: "GRCh37 · hg19",
    accession: "NC_000017.10",
    bases: "81,195,210",
    brca1: "g.41276050_41276051del",
  },
  grch38: {
    label: "GRCh38 · hg38",
    accession: "NC_000017.11",
    bases: "83,257,441",
    brca1: "g.43124027_43124028del",
  },
} as const;

export function BuildChips() {
  const [build, setBuild] = useState<keyof typeof BUILDS>("grch38");
  const row = BUILDS[build];
  return (
    <div className="w">
      <div className="switch" role="group" aria-label="reference assembly">
        {(Object.keys(BUILDS) as (keyof typeof BUILDS)[]).map((key) => (
          <button
            key={key}
            type="button"
            className={build === key ? "on" : ""}
            onClick={() => setBuild(key)}
          >
            {BUILDS[key].label}
          </button>
        ))}
      </div>
      <div className="toy-kv">
        <span>
          <span className="pair-key">chr17</span> {row.accession}
        </span>
        <span>
          <span className="pair-key">length</span> {row.bases}
        </span>
        <span>
          <span className="pair-key">185delAG</span> {row.brca1}
        </span>
      </div>
      <Hint>
        Same founder deletion, different numbers. The assemblies are different
        molecules, so the coordinates move. That conversion is called liftover.
      </Hint>
    </div>
  );
}

export function MiniGene() {
  const [spot, setSpot] = useState<"exon" | "intron" | null>(null);
  return (
    <div className="w">
      <div className="gene" aria-label="toy transcript with one intron">
        <button
          type="button"
          className={"exon" + (spot === "exon" ? " on" : "")}
          onClick={() => setSpot("exon")}
        >
          CDS
          <span className="exon-n">c.1 … 1095</span>
        </button>
        <button
          type="button"
          className={"intron" + (spot === "intron" ? " on" : "")}
          onClick={() => setSpot("intron")}
        >
          <span className="intron-line" />
          <span className="intron-tag">c.1096-1</span>
        </button>
        <button
          type="button"
          className={"exon" + (spot === "exon" ? " on" : "")}
          onClick={() => setSpot("exon")}
        >
          CDS
          <span className="exon-n">c.1096 …</span>
        </button>
      </div>
      <Hint>
        {spot === "intron" ? (
          <>
            <code>c.1096-1</code> is one base before the next exon. It is not a
            letter on this transcript. A plain Allele cannot sit there.
          </>
        ) : spot === "exon" ? (
          <>
            <code>c.</code> counts only these boxes. Introns are spliced out, so
            genomic and coding numbers disagree even on the plus strand.
          </>
        ) : (
          <>Click the intron or an exon.</>
        )}
      </Hint>
    </div>
  );
}

const KINDS = [
  {
    key: "g",
    label: "g. genomic",
    value: TOY_BRCA1_G,
    note: "A place on chromosome 17, GRCh38. The letters live on NC_000017.11.",
  },
  {
    key: "c",
    label: "c. coding",
    value: TOY_BRCA1_C,
    note: "The 68th and 69th bases of this transcript's CDS. Same clinic event, different molecule.",
  },
  {
    key: "p",
    label: "p. protein",
    value: "NP_009225.1:p.Glu23fs",
    note: "The protein consequence, not the DNA change. VRS can name a protein Allele; this tool translates DNA.",
  },
] as const;

export function HgvsKinds() {
  const [picked, setPicked] = useState<(typeof KINDS)[number]["key"]>("c");
  const row = KINDS.find((kind) => kind.key === picked) ?? KINDS[1];
  return (
    <div className="w">
      <div className="kind-list">
        {KINDS.map((kind) => (
          <button
            key={kind.key}
            type="button"
            className={"kind-row" + (picked === kind.key ? " on" : "")}
            onClick={() => setPicked(kind.key)}
          >
            <span className="kind-lab">{kind.label}</span>
            <span className="kind-val">{kind.value}</span>
          </button>
        ))}
      </div>
      <Hint>{row.note}</Hint>
    </div>
  );
}

const TYPES: { key: string; label: string; ref: string; alt: string; note: ReactNode }[] =
  [
    {
      key: "snv",
      label: "substitution",
      ref: "A",
      alt: "T",
      note: "One letter for another. BRAF V600E is this, written g.140753336A>T on chr7.",
    },
    {
      key: "del",
      label: "deletion",
      ref: "AG",
      alt: "",
      note: "Letters removed. BRCA1 185delAG is this: two coding bases gone.",
    },
    {
      key: "ins",
      label: "insertion",
      ref: "",
      alt: "TT",
      note: "Letters added between two cuts. The interval can have width zero.",
    },
    {
      key: "delins",
      label: "delins",
      ref: "CAG",
      alt: "GT",
      note: "A run replaced by a different run. Substitution of more than one base is this too.",
    },
  ];

function TypeTape({ seq, empty }: { seq: string; empty: string }) {
  if (!seq) return <span className="trim-empty">{empty}</span>;
  return (
    <span className="trim-tape">
      {seq.split("").map((char, i) => (
        <span key={i} className="trim-cell">
          {char}
        </span>
      ))}
    </span>
  );
}

export function VariantTypes() {
  const [picked, setPicked] = useState("del");
  const row = TYPES.find((type) => type.key === picked) ?? TYPES[1];
  return (
    <div className="w">
      <div className="type-grid">
        {TYPES.map((type) => (
          <button
            key={type.key}
            type="button"
            className={"type-card" + (picked === type.key ? " on" : "")}
            onClick={() => setPicked(type.key)}
          >
            <span className="type-lab">{type.label}</span>
            <span className="type-tapes">
              <TypeTape seq={type.ref} empty="∅" />
              <span className="type-arrow">→</span>
              <TypeTape seq={type.alt} empty="∅" />
            </span>
          </button>
        ))}
      </div>
      <Hint>{row.note}</Hint>
    </div>
  );
}

const FORMATS = [
  {
    key: "hgvs",
    label: "HGVS",
    spell: "c.68_69del",
    note: "Written for people. Ambiguous indels shift as far 3′ as they can.",
  },
  {
    key: "vcf",
    label: "VCF / gnomAD",
    spell: "17-43124026-GAG-G",
    note: "Written for pipelines. Left-aligned, and REF/ALT stay non-empty, so a leftover anchor base travels with the indel.",
  },
  {
    key: "spdi",
    label: "SPDI",
    spell: "NC_000017.11:43124026:AG:",
    note: "Sequence, Position, Deleted, Inserted. NCBI's computable form, and the closest cousin to VRS.",
  },
  {
    key: "vrs",
    label: "VRS",
    spell: `ga4gh:${TOY_VA}`,
    note: "The whole ambiguous region, then a hash of that object. No leftover pick of left vs 3′.",
  },
] as const;

export function FormatQuad() {
  const [picked, setPicked] = useState<(typeof FORMATS)[number]["key"]>("vrs");
  const row = FORMATS.find((fmt) => fmt.key === picked) ?? FORMATS[3];
  return (
    <div className="w">
      <div className="quad-seq" aria-hidden>
        <Tape window="GCAGAGAGTG" windowStart={0} cellClass={(pos) => (pos >= 2 && pos < 6 ? "in" : "")} />
        <span className="quad-cap">…GAGAG… minus one AG</span>
      </div>
      <div className="quad">
        {FORMATS.map((fmt) => (
          <button
            key={fmt.key}
            type="button"
            className={"quad-card" + (picked === fmt.key ? " on" : "")}
            onClick={() => setPicked(fmt.key)}
          >
            <span className="quad-lab">{fmt.label}</span>
            <span className="quad-spell">{fmt.spell}</span>
          </button>
        ))}
      </div>
      <Hint>{row.note}</Hint>
    </div>
  );
}

const LAYERS = [
  {
    key: "38",
    label: "GRCh38 · chr17",
    id: "ga4gh:VA.NTCeCp4z3OjbRZnp6I1mONPrRn7i-ugU",
    note: "The genomic Allele on today's chromosome 17. This is the molecule NC_000017.11, not the transcript.",
  },
  {
    key: "37",
    label: "GRCh37 · chr17",
    id: "ga4gh:VA.········ (previous assembly)",
    toy: true,
    note: "Same clinic event on the previous assembly. Different letters under the interval, so a different ID.",
  },
  {
    key: "mane",
    label: "MANE · NM_007294.4",
    id: `ga4gh:${TOY_VA}`,
    note: "The transcript is its own sequence. A coding Allele hashes that molecule, not the chromosome.",
  },
  {
    key: "prot",
    label: "protein · NP_009225.1",
    id: "ga4gh:VA.········ (amino acids)",
    toy: true,
    note: "The protein is a third molecule. Fig. 4B in Wagner et al. 2021 is this stack: one clinic, several IDs.",
  },
] as const;

export function ContextStack() {
  const [picked, setPicked] = useState("38");
  const row = LAYERS.find((layer) => layer.key === picked) ?? LAYERS[0];
  return (
    <div className="w">
      <div className="stack">
        {LAYERS.map((layer) => (
          <button
            key={layer.key}
            type="button"
            className={"stack-layer" + (picked === layer.key ? " on" : "")}
            onClick={() => setPicked(layer.key)}
          >
            <span className="stack-lab">{layer.label}</span>
            <span className={"stack-id" + ("toy" in layer && layer.toy ? " toy" : "")}>
              {layer.id}
            </span>
          </button>
        ))}
      </div>
      <Hint>
        {row.note}
        {"toy" in row && row.toy ? <span className="warn-tag">toy id</span> : null}
      </Hint>
    </div>
  );
}

export function StrandFlip() {
  const [face, setFace] = useState<"plus" | "minus">("plus");
  return (
    <div className="w">
      <div className="strand">
        <div className={"strand-row" + (face === "plus" ? " on" : "")}>
          <span className="strand-lab">+ genomic</span>
          <span className="strand-dir">5′</span>
          <span className="trim-tape">
            {"CT".split("").map((char, i) => (
              <span key={i} className="trim-cell">
                {char}
              </span>
            ))}
          </span>
          <span className="strand-dir">3′</span>
        </div>
        <div className={"strand-row" + (face === "minus" ? " on" : "")}>
          <span className="strand-lab">− BRCA1</span>
          <span className="strand-dir">3′</span>
          <span className="trim-tape">
            {"GA".split("").map((char, i) => (
              <span key={i} className="trim-cell">
                {char}
              </span>
            ))}
          </span>
          <span className="strand-dir">5′</span>
        </div>
      </div>
      <div className="switch" role="group" aria-label="which strand to read">
        <button
          type="button"
          className={face === "plus" ? "on" : ""}
          onClick={() => setFace("plus")}
        >
          read plus
        </button>
        <button
          type="button"
          className={face === "minus" ? "on" : ""}
          onClick={() => setFace("minus")}
        >
          read as the gene does
        </button>
      </div>
      <Hint>
        {face === "plus" ? (
          <>
            The reference stores the plus strand. Those two letters are{" "}
            <code>CT</code> on GRCh38.
          </>
        ) : (
          <>
            BRCA1 is transcribed off the minus strand, 5′ to 3′ leftward here, so
            the same stretch reads <code>AG</code>. That is the{" "}
            <code>c.68_69del</code> spelling.
          </>
        )}
      </Hint>
    </div>
  );
}

export function ValueObject() {
  const [start, setStart] = useState(178);
  const [label, setLabel] = useState("185delAG");
  const inherent = start === 178;
  return (
    <div className="w">
      <div className="value-grid">
        <label className="value-field">
          <span className="rle-label">start</span>
          <input
            type="number"
            value={start}
            onChange={(event) => setStart(Number(event.target.value))}
          />
        </label>
        <label className="value-field">
          <span className="rle-label">label</span>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>
      <div className={"value-id" + (inherent ? "" : " toy")}>
        <span className="pill-ns">ga4gh:</span>
        {inherent ? TOY_VA : "VA.········ (different bytes)"}
      </div>
      <Hint>
        {inherent ? (
          <>
            The label is now {label ? <code>{label}</code> : "empty"}. It never
            enters the hash, so the identifier stays put.
          </>
        ) : (
          <>
            <code>start</code> changed, so the object is different. The ID is
            derived, not assigned.
            <span className="warn-tag">toy id</span>
          </>
        )}
      </Hint>
    </div>
  );
}

export function MoleculeVsCell() {
  const [side, setSide] = useState<"mol" | "cell">("mol");
  return (
    <div className="w">
      <div className="pair-cards">
        <button
          type="button"
          className={"pair-card" + (side === "mol" ? " on" : "")}
          onClick={() => setSide("mol")}
        >
          <span className="quad-lab">molecule</span>
          <span className="pair-body">one duplex, these letters, this place</span>
        </button>
        <button
          type="button"
          className={"pair-card" + (side === "cell" ? " on" : "")}
          onClick={() => setSide("cell")}
        >
          <span className="quad-lab">cell</span>
          <span className="pair-body">how many copies sit in this nucleus</span>
        </button>
      </div>
      <Hint>
        {side === "mol" ? (
          <>
            An Allele is this column. Identity does not care whether the sample
            is germline or tumor.
          </>
        ) : (
          <>
            Copy-number and systemic variation are statements about a cell, not
            about this molecule. Out of scope for inspect.
          </>
        )}
      </Hint>
    </div>
  );
}

const PIPE = [
  { key: "paste", label: "paste" },
  { key: "uta", label: "UTA" },
  { key: "seqrepo", label: "SeqRepo" },
  { key: "allele", label: "Allele" },
] as const;

export function ServicePipe() {
  const [coding, setCoding] = useState(true);
  const [step, setStep] = useState<(typeof PIPE)[number]["key"]>("uta");
  const skipped = !coding && step === "uta";

  const hint =
    step === "paste" ? (
      <>
        {coding ? (
          <>
            A <code>c.</code> expression names a transcript. Someone has to map
            those coding coordinates onto the actual sequence.
          </>
        ) : (
          <>
            A <code>g.</code> expression already names a chromosomal sequence.
            No projection step.
          </>
        )}
      </>
    ) : step === "uta" ? (
      skipped ? (
        <>UTA is not consulted. Genomic expressions skip this service.</>
      ) : (
        <>
          UTA holds transcript alignments. It is why <code>c.</code> needs a
          database and a genomic SNV does not.
        </>
      )
    ) : step === "seqrepo" ? (
      <>
        SeqRepo turns the accession into <code>ga4gh:SQ.…</code> and returns the
        letters around the interval.
      </>
    ) : (
      <>From here the object is an Allele: location plus state, ready to hash.</>
    );

  return (
    <div className="w">
      <div className="switch" role="group" aria-label="expression kind">
        <button type="button" className={coding ? "on" : ""} onClick={() => setCoding(true)}>
          c. coding
        </button>
        <button type="button" className={!coding ? "on" : ""} onClick={() => setCoding(false)}>
          g. genomic
        </button>
      </div>
      <div className="pipe">
        {PIPE.map((node, i) => (
          <span key={node.key} className="pipe-wrap">
            {i > 0 && <span className="pipe-link" aria-hidden />}
            <button
              type="button"
              className={
                "pipe-node" +
                (step === node.key ? " on" : "") +
                (node.key === "uta" && !coding ? " skip" : "")
              }
              onClick={() => setStep(node.key)}
            >
              {node.label}
            </button>
          </span>
        ))}
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function RegistryVsComputed() {
  const [kind, setKind] = useState<"assigned" | "computed">("computed");
  return (
    <div className="w">
      <div className="pair-cards">
        <button
          type="button"
          className={"pair-card" + (kind === "assigned" ? " on" : "")}
          onClick={() => setKind("assigned")}
        >
          <span className="quad-lab">assigned</span>
          <span className="sticker">VCV000017661</span>
        </button>
        <button
          type="button"
          className={"pair-card" + (kind === "computed" ? " on" : "")}
          onClick={() => setKind("computed")}
        >
          <span className="quad-lab">computed</span>
          <span className="digest-pill">
            <span className="pill-ns">ga4gh:</span>
            {TOY_VA}
          </span>
        </button>
      </div>
      <Hint>
        {kind === "assigned" ? (
          <>
            ClinVar chose this sticker and keeps a record. Useful as a catalog
            key. Useless as identity if the other system does not share that
            catalog.
          </>
        ) : (
          <>
            Anyone who builds the same Allele computes this string. No registry
            sits in between.
          </>
        )}
      </Hint>
    </div>
  );
}
