from __future__ import annotations

import importlib
from unittest.mock import patch


def test_config_dotenv_exception():
    with patch.dict("sys.modules", {"dotenv": None}):
        import app.config
        importlib.reload(app.config)
        assert app.config.settings is not None