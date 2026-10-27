"""Dataset loading. Stdlib only (csv + Decimal + json).

All money stays in Decimal until the API boundary, where values are
serialized as fixed-point strings such as "120000.00".
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

TABLE_FILES = {
    "invoices": "invoices.csv",
    "supplier_bills": "supplier_bills.csv",
    "bank": "bank.csv",
    "sales": "sales.csv",
    "inventory": "inventory.csv",
}

ID_FIELDS = {
    "invoices": "invoice_id",
    "supplier_bills": "bill_id",
    "bank": "txn_id",
    "sales": "sale_id",
    "inventory": "product_id",
}

CENT = Decimal("0.01")


def parse_decimal(raw: str) -> Decimal:
    return Decimal((raw or "").strip())


def parse_date(raw: str) -> date:
    return date.fromisoformat(raw.strip())


def q2(value: Decimal) -> Decimal:
    """Round money to cents."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def money(value: Decimal) -> str:
    return str(q2(value))


def pct(numerator: Decimal, denominator: Decimal) -> Decimal:
    """Percentage rounded to 2dp. Raises on zero denominator: callers must
    treat a missing base as unknown, never as zero."""
    if denominator == 0:
        raise ZeroDivisionError("percentage base is zero; refusing to invent a value")
    return q2(numerator / denominator * Decimal(100))


@dataclass
class DataBundle:
    data_dir: Path
    meta: dict
    tables: dict[str, list[dict]] = field(default_factory=dict)

    def table(self, name: str) -> list[dict]:
        return self.tables[name]

    def by_id(self, name: str) -> dict[str, dict]:
        id_field = ID_FIELDS[name]
        return {row[id_field]: row for row in self.tables[name]}


def load_bundle(data_dir: str | Path) -> DataBundle:
    data_dir = Path(data_dir)
    with open(data_dir / "meta.json", encoding="utf-8") as fh:
        meta = json.load(fh)
    tables: dict[str, list[dict]] = {}
    for name, filename in TABLE_FILES.items():
        with open(data_dir / filename, newline="", encoding="utf-8") as fh:
            tables[name] = list(csv.DictReader(fh))
    return DataBundle(data_dir=data_dir, meta=meta, tables=tables)
