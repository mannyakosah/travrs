"""Public-service defaults so TraVerse runs with zero local data."""

from __future__ import annotations

import os

DEFAULT_DATAPROXY_URI = "seqrepo+https://services.genomicmedlab.org/seqrepo"
DEFAULT_UTA_DB_URL = (
    "postgresql://anonymous:anonymous@uta.biocommons.org:5432/uta/uta_20241220"
)


def apply_defaults() -> None:
    """Fill in public SeqRepo + UTA URLs unless the user already set them."""
    os.environ.setdefault("GA4GH_VRS_DATAPROXY_URI", DEFAULT_DATAPROXY_URI)
    os.environ.setdefault("UTA_DB_URL", DEFAULT_UTA_DB_URL)
