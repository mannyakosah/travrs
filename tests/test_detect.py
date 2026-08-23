from traverse.detect import UnknownFormatError, detect
import pytest


def test_hgvs_coding():
    d = detect("NM_007294.4:c.68_69del")
    assert d.fmt == "hgvs"
    assert d.parsed["kind"] == "c"


def test_hgvs_with_gene():
    d = detect("NM_005188.4(CBL):c.1096-1G>C")
    assert d.fmt == "hgvs"
    assert "Intronic" in d.note


def test_hgvs_repeat_notation_flagged():
    d = detect("NC_000001.11:g.930139CCT[1]")
    assert d.fmt == "hgvs"
    assert "#582" in d.note


def test_spdi():
    d = detect("NC_000017.11:43124026:AG:")
    assert d.fmt == "spdi"
    assert d.parsed["deleted"] == "AG"


def test_gnomad():
    d = detect("17-43124027-CAG-C")
    assert d.fmt == "gnomad"
    assert d.parsed["ref"] == "CAG"


def test_vrs_json():
    d = detect('{"type": "Allele", "location": {}}')
    assert d.fmt == "vrs"


def test_vrs_id():
    d = detect("ga4gh:VA.exampledigeststring____________")
    assert d.fmt == "vrs_id"


def test_unknown():
    with pytest.raises(UnknownFormatError):
        detect("BRAF V600E")
