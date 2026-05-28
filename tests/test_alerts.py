from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from app.alerts import _send_alert_evaluation, trigger_alert_evaluation


@patch("app.alerts.requests.post")
def test_send_alert_evaluation_success(mock_post):
    dt = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    _send_alert_evaluation(1, 20.5, dt)
    mock_post.assert_called_once()
    payload = mock_post.call_args[1]["json"]
    assert payload["parameterId"] == 1
    assert payload["measuredValue"] == 20.5
    assert payload["occurredAt"] == "2023-01-01T12:00:00Z"


@patch("app.alerts.requests.post", side_effect=Exception("timeout"))
@patch("app.alerts.logger.warning")
def test_send_alert_evaluation_exception(mock_logger, mock_post):
    dt = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    _send_alert_evaluation(1, 20.5, dt)
    mock_logger.assert_called_once()


@patch("app.alerts._executor.submit")
def test_trigger_alert_evaluation(mock_submit):
    dt = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    trigger_alert_evaluation(1, 20.5, dt)
    mock_submit.assert_called_once_with(_send_alert_evaluation, 1, 20.5, dt)