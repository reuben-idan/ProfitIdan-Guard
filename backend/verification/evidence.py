"""Evidence registry: every cited ID must resolve to a real source record."""

from __future__ import annotations

from ..finance.datasets import ID_FIELDS, DataBundle


class EvidenceRegistry:
    def __init__(self, bundle: DataBundle):
        self._index: dict[str, tuple[str, dict]] = {}
        for table, id_field in ID_FIELDS.items():
            for row in bundle.table(table):
                self._index[row[id_field]] = (table, row)

    def resolve(self, evidence_id: str) -> tuple[str, dict] | None:
        return self._index.get(evidence_id)

    def missing(self, evidence_ids: list[str]) -> list[str]:
        return [eid for eid in evidence_ids if eid not in self._index]
