"""Keep published-site validation aligned with its declared default branch."""

import importlib.util
import json
import os
import subprocess
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "site_workflow_contracts", ROOT / "scripts/workflow_contracts.py"
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Cannot load workflow contract parser")
CONTRACTS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTRACTS)


def workflow(name):
    return yaml.load(
        (ROOT / ".github/workflows" / name).read_text(),
        Loader=CONTRACTS.UniqueKeyLoader,
    )


class SiteBranchPolicyTests(unittest.TestCase):
    def test_default_and_every_publication_push_target_agree(self):
        policy = json.loads((ROOT / ".release-policy.json").read_text())
        self.assertEqual(policy["default_branch"], "main")
        self.assertEqual(policy["mode"], "validation-only")
        for name in ("quality-gate.yml", "scorecards.yml", "live-interaction.yml"):
            with self.subTest(workflow=name):
                self.assertEqual(
                    workflow(name)["on"]["push"],
                    {"branches": [policy["default_branch"]]},
                )

    def test_quality_gate_preserves_all_entry_points(self):
        events = workflow("quality-gate.yml")["on"]
        self.assertEqual(
            set(events),
            {
                "pull_request",
                "merge_group",
                "workflow_call",
                "push",
                "schedule",
                "workflow_dispatch",
            },
        )
        self.assertEqual(events["pull_request"], {})
        self.assertTrue(events["schedule"][0]["cron"])

    def test_scorecard_keeps_scheduled_manual_and_default_branch_guards(self):
        scorecard = workflow("scorecards.yml")
        self.assertEqual(
            set(scorecard["on"]),
            {"branch_protection_rule", "schedule", "push", "workflow_dispatch"},
        )
        self.assertTrue(scorecard["on"]["schedule"][0]["cron"])
        self.assertEqual(
            scorecard["jobs"]["analysis"]["if"],
            "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
        )

    def test_always_gate_rejects_non_successful_or_missing_results(self):
        gate = workflow("quality-gate.yml")["jobs"]["gate"]
        self.assertEqual(gate["if"], "${{ always() }}")
        command = next(
            step["run"]
            for step in gate["steps"]
            if step.get("name") == "Require every validation workflow"
        )
        cases = [
            ("success", True),
            ("failure", False),
            ("cancelled", False),
            ("skipped", False),
        ]
        for result, expected_success in cases + [(None, False)]:
            with self.subTest(result=result):
                results = {"validator": {"result": result}} if result else {}
                process = subprocess.run(
                    ["bash", "-e", "-c", command],
                    env={**os.environ, "RESULTS": json.dumps(results)},
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
                self.assertEqual(
                    process.returncode == 0, expected_success, process.stderr
                )


if __name__ == "__main__":
    unittest.main()
