"""Challenge test fields: fixed reference centres, not epoch-propagated positions."""

from pydantic import BaseModel

from spherex.models import RA, Dec


class TestTarget(BaseModel):
    id: str
    name: str
    ra: RA
    dec: Dec
    radius_deg: float = 0.15
    fov_deg: float = 0.3
    coordinate_source: str
    notes: str = (
        "Reference field centre; no proper-motion/parallax propagation. "
        "The wide field accommodates motion since the reference epoch. "
        "Archive coverage does not establish detection of the named object."
    )


TARGETS = [
    TestTarget(
        id="barnards-star",
        name="Barnard's Star",
        ra=269.4520769586,
        dec=4.6933649666,
        coordinate_source="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Barnard%27s+star",
    ),
    TestTarget(
        id="epsilon-indi-b",
        name="Epsilon Indi B",
        ra=331.0441465885,
        dec=-56.7828441951,
        coordinate_source="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eps+Ind+B",
    ),
    TestTarget(
        id="wise-0855",
        name="WISE 0855",
        ra=(8 + 55 / 60 + 10.831 / 3600) * 15,
        dec=-(7 + 14 / 60 + 42.53 / 3600),
        coordinate_source="https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/",
        notes="Coordinates supplied in the challenge, epoch unspecified. "
        "Not propagated for proper motion. Coverage is not a source detection.",
    ),
    TestTarget(
        id="rw-aurigae",
        name="RW Aurigae",
        ra=76.9565260346,
        dec=30.4014381739,
        coordinate_source="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RW+Aur",
    ),
    TestTarget(
        id="r-draconis",
        name="R Draconis",
        ra=248.1676108330,
        dec=66.7549794172,
        coordinate_source="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=R+Dra",
    ),
]
