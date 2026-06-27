"""Smoke test for the multi-agent fraud investigation pipeline."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crews.fraud_investigation_crew import FraudInvestigationCrew

logging.basicConfig(level=logging.INFO)


def build_synthetic_provider_df(n_providers: int = 20) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    providers = [f"PRV{10000 + i}" for i in range(n_providers)]
    total_claims = rng.integers(50, 500, size=n_providers)
    unique_patients = rng.integers(20, 200, size=n_providers)

    return pd.DataFrame({
        "Provider": providers,
        "TotalReimbursed": rng.uniform(50_000, 500_000, size=n_providers),
        "AvgReimbursed": rng.uniform(500, 5000, size=n_providers),
        "MaxReimbursed": rng.uniform(5_000, 20_000, size=n_providers),
        "TotalClaims": total_claims,
        "InpatientRatio": rng.uniform(0.1, 0.9, size=n_providers),
        "PatientsPerClaim": unique_patients / total_claims,
        "PhysiciansPerClaim": rng.uniform(0.05, 0.5, size=n_providers),
        "SameAttendOperRate": rng.uniform(0.0, 0.3, size=n_providers),
        "DeceasedPatientRate": rng.uniform(0.0, 0.2, size=n_providers),
        "AvgClaimDuration": rng.uniform(1, 30, size=n_providers),
        "MaxClaimDuration": rng.uniform(10, 90, size=n_providers),
        "AvgDaysInHospital": rng.uniform(0, 10, size=n_providers),
        "TotalDaysInHospital": rng.uniform(0, 500, size=n_providers),
        "AvgDeductible": rng.uniform(0, 500, size=n_providers),
        "TotalDeductible": rng.uniform(0, 10_000, size=n_providers),
        "UniquePatients": unique_patients,
        "AvgPatientAge": rng.uniform(55, 85, size=n_providers),
        "AvgChronicConds": rng.uniform(1, 6, size=n_providers),
    })


def main() -> None:
    provider_df = build_synthetic_provider_df()
    fraud_probs = pd.DataFrame({
        "Provider": provider_df["Provider"],
        "fraud_probability": np.linspace(0.3, 0.95, len(provider_df)),
    })

    output_dir = ROOT / "outputs_test"
    crew = FraudInvestigationCrew(output_dir=str(output_dir))
    reports = crew.investigate(provider_df, fraud_probs, threshold=0.6)

    assert reports, "Expected at least one investigation report above threshold"
    coordinator = reports[0]["investigation_summary"]["coordinator"]
    required_keys = {
        "Fraud Score",
        "Provider Risk",
        "Claim Risk",
        "Beneficiary Risk",
        "Evidence",
        "Recommendation",
        "Priority",
        "Confidence",
    }
    missing = required_keys - set(coordinator.keys())
    assert not missing, f"Coordinator report missing keys: {missing}"

    combined_path = output_dir / "investigation_reports.json"
    assert combined_path.exists(), "Combined investigation report was not written"

    print(f"Investigation smoke test passed: {len(reports)} report(s) generated.")
    print(f"Sample provider: {reports[0]['Provider']}")
    print(f"Fraud Score: {coordinator['Fraud Score']}")


if __name__ == "__main__":
    main()
