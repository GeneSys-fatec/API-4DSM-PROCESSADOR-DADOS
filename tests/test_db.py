from __future__ import annotations

from decimal import Decimal

from app.db import _decimal_or_none


def test_decimal_or_none_returns_decimal_for_numeric_values() -> None:
    assert _decimal_or_none(4.01) == Decimal("4.01")


def test_decimal_or_none_returns_none_for_invalid_values() -> None:
    assert _decimal_or_none("4,01") is None