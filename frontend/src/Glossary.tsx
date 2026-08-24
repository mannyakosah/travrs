import { useEffect, type ReactNode } from "react";
import { SiteFooter, SiteHeader, inspectHref } from "./chrome";
import {
  AccessionFunnel,
  ExpandBrackets,
  HashFunnel,
  IntervalRuler,
} from "./widgets/index";
import {
  BuildChips,
  ContextStack,
  FormatQuad,
  HgvsKinds,
  MiniGene,
  MoleculeVsCell,
  RegistryVsComputed,
  ServicePipe,
  StrandFlip,
  TOY_ACCESSION,
  TOY_BRCA1_C,
  TOY_EXPAND,
  TOY_HASH,
  TOY_RULER,
  ValueObject,
  VariantTypes,
} from "./widgets/toys";
import "./Glossary.css";

type Entry = {
  id: string;
  term: string;
  phrase: string;
  prose: string;
  visual: ReactNode;
};

const ENTRIES: Entry[] = [
  {
    id: "reference-genome",
    term: "Reference genome",
    phrase: "a shared spelling",
    prose:
      "DNA is a string of A, C, G, T. To name a position, labs have to agree which spelling of the genome they are counting on. That agreed, versioned spelling is a reference genome. GRCh38 is the current human assembly; GRCh37 is the previous one and is still common in the clinic. The assemblies differ, so the same physical change sits at different numbers on the two builds. Converting those numbers is liftover. This page names the sequence you already pointed at; it does not lift over.",
    visual: <BuildChips />,
  },
  {
    id: "accession",
    term: "Accession",
    phrase: "catalog name, not the sequence",
    prose:
      "A sequence is just letters. Catalogs give those letters a lookup name so you can retrieve them later. That name is an accession: NC_000017.11 is RefSeq's name for GRCh38 chromosome 17; NM_007294.4 is a BRCA1 transcript. The version suffix is part of the name : .11 and .10 are different molecules. VRS never stores the accession. It stores a digest of the letters themselves, written ga4gh:SQ. Two catalogs can label the same molecule differently and still agree on that digest.",
    visual: (
      <AccessionFunnel
        pasted={TOY_ACCESSION.pasted}
        digest={TOY_ACCESSION.digest}
        data={TOY_ACCESSION.data}
      />
    ),
  },
  {
    id: "transcript",
    term: "Transcript",
    phrase: "why c. is hard",
    prose:
      "A gene on the chromosome is longer than the RNA it produces. Cells copy the gene, then splice out the introns, leaving the exons as the transcript. HGVS c. numbers only the coding bases of one chosen transcript, so c.68 is not genomic position 68. Intronic expressions like c.1096-1 name a base that is not on the transcript at all: one base before the exon that starts at c.1096. A VRS Allele lives on one sequence. Those intron offsets need a genomic projection, or VRS 2.1 RelativeAllele.",
    visual: <MiniGene />,
  },
  {
    id: "hgvs-kinds",
    term: "HGVS g. c. p.",
    phrase: "three molecules, one event",
    prose:
      "HGVS is a human-readable language for writing sequence changes. The letter after the colon says which molecule you numbered: g. is a place on a chromosome, c. is a place in one transcript's coding sequence, p. is the protein consequence. The same BRCA1 founder deletion can be written all three ways. They are not three IDs for one molecule. They are three molecules — chromosome, RNA, protein — describing one clinical event.",
    visual: <HgvsKinds />,
  },
  {
    id: "variant-types",
    term: "Variant types",
    phrase: "SNV, del, ins, delins",
    prose:
      "When a change is contiguous on one sequence, it has one of four shapes this tool translates. A substitution replaces letters with other letters. A deletion removes them. An insertion adds them. A delins does both. Duplications, HGVS repeat notation, and large rearrangements are recognized and explained here, not turned into an Allele.",
    visual: <VariantTypes />,
  },
  {
    id: "inter-residue",
    term: "Inter-residue coordinates",
    phrase: "count the gaps",
    prose:
      "If you number the letters 1, 2, 3…, an insertion has no letter to sit on : it lives between two letters. A deletion, meanwhile, includes the letters it removes. Residue coordinates therefore change meaning with the operation. VRS numbers the cuts between letters instead, and writes a half-open interval [start, end). Substitution, deletion, and insertion all mean the same thing: the bases between two cuts, or no bases if the cuts coincide. That is why VRS coordinates are not merely 0-based.",
    visual: <IntervalRuler ruler={TOY_RULER} interactive />,
  },
  {
    id: "formats",
    term: "Formats",
    phrase: "HGVS, VCF, SPDI, VRS",
    prose:
      "The same molecular event is written in different languages for different jobs. HGVS is written for people and shifts an ambiguous indel as far 3′ as it can. VCF is written for pipelines, left-aligns the same indel, and keeps a non-empty anchor base. SPDI (Sequence, Position, Deleted, Inserted) is NCBI's computable form. VRS refuses to pick a representative position. It states the whole ambiguous region and hashes that.",
    visual: <FormatQuad />,
  },
  {
    id: "normalization",
    term: "Normalization",
    phrase: "don't pick a position",
    prose:
      "When a change sits inside a repeat, honest callers can write it at more than one place. That is not three variants but rather one event with an ambiguous placement. VCF picks the left. HGVS picks 3′. VRS covers the entire stretch the change could occupy (full justification, after NCBI VOCA), then encodes the leftover state. Two files that disagreed about the numbers still compute one identifier.",
    visual: (
      <ExpandBrackets
        ruler={TOY_EXPAND.ruler}
        before={TOY_EXPAND.before}
        after={TOY_EXPAND.after}
      />
    ),
  },
  {
    id: "digest",
    term: "Computed identifier",
    phrase: "fingerprint of the object",
    prose:
      "Most catalog IDs are assigned: a registry chooses a string and keeps a record. A VRS computed identifier is the opposite. The Allele is serialized in a fixed way, hashed with SHA-512, and shortened to 24 bytes of base64url. Anyone who builds the same Allele gets the same ga4gh:VA. string. No central authority is in the path. That is what Wagner et al. call federated identification.",
    visual: <HashFunnel data={TOY_HASH} />,
  },
  {
    id: "value-object",
    term: "Value object",
    phrase: "identity is the content",
    prose:
      "Some records are identified by a name you give them : eg a patient ID, a ClinVar accession. A value object is identified by what it contains. Change a coordinate or a base and you have a different Allele with a different ID. Change a display label and you still have the same Allele. The identifier is not assigned. It is derived. That is what makes federation possible without a shared database of names.",
    visual: <ValueObject />,
  },
  {
    id: "context",
    term: "Context",
    phrase: "same clinic, different IDs",
    prose:
      "A clinic can treat BRCA1 185delAG as one finding. Under that name sit several molecules: GRCh37 chr17, GRCh38 chr17, a coding transcript, and the protein. Each is a different sequence, so VRS gives each its own Allele and its own ID. A computed identifier fingerprints one sequence context; it does not stand for the clinical concept that spans them. Linking those IDs is a registry's job. Wagner et al. 2021, Fig. 4B: the stack is the design.",
    visual: <ContextStack />,
  },
  {
    id: "strand",
    term: "Strand",
    phrase: "why BRCA1 c. and g. look unrelated",
    prose:
      "DNA is a double helix. A reference genome writes only one strand of it, the plus strand. Genes can be encoded on the other. BRCA1 is on the minus strand of chromosome 17, so the genomic spelling and the transcript spelling of 185delAG do not look like the same letters. Reverse-complement the genomic bases and the relationship appears.",
    visual: <StrandFlip />,
  },
  {
    id: "molecular-vs-systemic",
    term: "Molecular vs systemic",
    phrase: "duplex ≠ copy-number gain",
    prose:
      "VRS asks two different questions. Molecular variation: what letters sit on this one molecule? Systemic variation: how many molecules, or how much product, are present in a cell or sample? An Allele answers the first. A copy-number gain answers the second. HGVS dup has been used for both, which is how a tandem duplication and a copy-number count get confused. This tool computes Alleles. It does not count copies.",
    visual: <MoleculeVsCell />,
  },
  {
    id: "seqrepo-uta",
    term: "SeqRepo and UTA",
    phrase: "the two services",
    prose:
      "To turn a pasted string into an Allele, the translator needs two kinds of lookup. UTA is a transcript-alignment database. It is consulted when a coding or noncoding HGVS expression has to be projected onto a sequence. SeqRepo is a sequence store. It turns an accession into a content digest and returns the letters around the interval. Genomic g. expressions already name a chromosomal sequence, so they skip UTA.",
    visual: <ServicePipe />,
  },
  {
    id: "registries",
    term: "Registries",
    phrase: "assigned vs computed IDs",
    prose:
      "ClinVar, ClinGen, and dbSNP give you identifiers they chose and stored. ClinVar's VCV000017661 is one of those: useful as a catalog key, meaningless to a system that does not share the catalog. ga4gh:VA. is computed from the bytes. Assigned IDs are how humans look things up. Computed IDs are how machines agree they are talking about the same Allele.",
    visual: <RegistryVsComputed />,
  },
];

export default function Glossary() {
  useEffect(() => {
    document.title = "traVRS · glossary";
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
  }, []);

  return (
    <div className="page glossary">
      <SiteHeader>
        <h1 className="page-title">Glossary</h1>
        <p className="lede">
          Terms the inspect page uses. Each entry starts from what the thing is,
          then how VRS uses it.
        </p>
        <p className="g-example">
          Toys use BRCA1 185delAG,{" "}
          <code>{TOY_BRCA1_C}</code>
          .{" "}
          <a href={inspectHref(TOY_BRCA1_C)}>Inspect that variant</a>
        </p>
      </SiteHeader>

      <nav className="g-toc" aria-label="entries">
        {ENTRIES.map((entry) => (
          <a key={entry.id} className="g-toc-row" href={`#${entry.id}`}>
            <span className="g-toc-term">{entry.term}</span>
            <span className="g-toc-phrase">{entry.phrase}</span>
          </a>
        ))}
      </nav>

      {ENTRIES.map((entry) => (
        <article key={entry.id} id={entry.id} className="g-entry">
          <h2>{entry.term}</h2>
          <p className="g-phrase">{entry.phrase}</p>
          <p className="g-prose">{entry.prose}</p>
          {entry.visual}
        </article>
      ))}

      <SiteFooter here="glossary" />
    </div>
  );
}
