#!/usr/bin/env python3
"""Smoke-test: one HGVS string through official vrs-python + public data services.

    cd backend && source .venv/bin/activate
    python hello_vrs.py
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault(
    "UTA_DB_URL",
    "postgresql://anonymous:anonymous@uta.biocommons.org:5432/uta/uta_20241220",
)
os.environ.setdefault(
    "GA4GH_VRS_DATAPROXY_URI",
    "seqrepo+https://services.genomicmedlab.org/seqrepo",
)

from ga4gh.vrs.dataproxy import create_dataproxy
from ga4gh.vrs.extras.translator import AlleleTranslator

HGVS = "NM_007294.4:c.68_69del"  # BRCA1 185delAG founder mutation


def main() -> int:
    print("Connecting to public SeqRepo REST…", flush=True)
    dp = create_dataproxy(os.environ["GA4GH_VRS_DATAPROXY_URI"])
    tr = AlleleTranslator(dp)

    print(f"Translating {HGVS} via vrs-python AlleleTranslator…", flush=True)
    allele = tr.translate_from(HGVS, "hgvs")

    print()
    print(allele.model_dump_json(indent=2, exclude_none=True, by_alias=True))
    print()
    print("ID:  ", allele.id)
    print("SPDI:", tr.translate_to(allele, "spdi"))
    print("HGVS:", tr.translate_to(allele, "hgvs"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
