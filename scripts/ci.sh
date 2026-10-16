#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/validate-source.py
python3 scripts/validate_redirect.py
python3 scripts/workflow_contracts.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 -m unittest discover -s .github/workflow-tests -p 'test_*.py'
