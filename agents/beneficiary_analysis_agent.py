from __future__ import annotations

import logging
import os
from typing import Any

from utils.investigation_utils import (
    build_evidence_item,
    is_metric_elevated,
    score_from_evidence,
)

logger = logging.getLogger(__name__)


class BeneficiaryAnalysisAgent:
    """Analyses beneficiary demographics and utilization concentration."""

    METRICS: dict[str, str] = {
        "UniquePatients": "low",
        "PatientsPerClaim": "low",
        "DeceasedPatientRate": "high",
        "AvgPatientAge": "high",
        "AvgChronicConds": "high",
        "RepeatVisitsRatio": "high",
        "BeneficiaryConcentration": "high",
        "ChronicPatientRatio": "high",
        "SharedDiagnosisRatio": "high",
        "ProviderDependency": "high",
    }

    def __init__(self) -> None:
        self._crew_agent = None

    @property
    def agent(self):
        if self._crew_agent is None:
            from crewai import Agent

            google_api_key = os.environ.get("GOOGLE_API_KEY")
            if google_api_key:
                os.environ["GEMINI_API_KEY"] = google_api_key
                llm = "gemini/gemini-1.5-flash"
            else:
                llm = None

            self._crew_agent = Agent(
            role="Beneficiary Risk Analyst",
            goal="Assess beneficiary-level concentration and utilization patterns linked to provider fraud",
            backstory=(
                "You inspect beneficiary uniqueness, mortality burden, and patient concentration to identify "
                "providers that have unusually concentrated or high-risk patient populations."
            ),
            verbose=False,
            allow_delegation=False,
                llm=llm,
            )
        return self._crew_agent

    def analyze(
        self,
        provider_row: dict[str, Any],
        reference_stats: dict[str, dict[str, float]],
    ) -> dict[str, Any]:
        """Evaluate beneficiary concentration and utilization against peer statistics."""
        evidence: list[dict[str, Any]] = []

        for metric, direction in self.METRICS.items():
            value = provider_row.get(metric)
            if value is None or not isinstance(value, (int, float)):
                continue

            ref = reference_stats.get(metric)
            if not ref:
                continue

            signal = is_metric_elevated(float(value), ref, direction=direction)
            if signal:
                evidence.append(build_evidence_item(metric, float(value), ref, signal))

        beneficiary_score = score_from_evidence(
            evidence,
            base_score=0.2,
            evidence_weight=0.1,
        )

        logger.debug(
            "Beneficiary analysis for %s: score=%s evidence_count=%s",
            provider_row.get("Provider"),
            beneficiary_score,
            len(evidence),
        )

        return {
            "agent": "beneficiary",
            "risk_score": beneficiary_score,
            "evidence": evidence,
        }
