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


class ProviderAnalysisAgent:
    """Analyses provider-level billing and utilization patterns."""

    METRICS: dict[str, str] = {
        "TotalReimbursed": "high",
        "AvgReimbursed": "high",
        "TotalClaims": "high",
        "InpatientRatio": "high",
        "OutpatientRatio": "low",
        "ClaimGrowth": "high",
        "PatientsPerClaim": "low",
        "PhysiciansPerClaim": "low",
        "SameAttendOperRate": "high",
        "DeceasedPatientRate": "high",
    }

    def __init__(self) -> None:
        self._crew_agent = None

    @property
    def agent(self):
        """Lazy-load the CrewAI agent when LLM-backed workflow is required."""
        if self._crew_agent is None:
            from crewai import Agent

            google_api_key = os.environ.get("GOOGLE_API_KEY")
            if google_api_key:
                os.environ["GEMINI_API_KEY"] = google_api_key
                llm = "gemini/gemini-1.5-flash"
            else:
                llm = None

            self._crew_agent = Agent(
            role="Provider Risk Analyst",
            goal="Evaluate provider-level risk using fraud probability and provider behavior patterns",
            backstory=(
                "You review provider billing behavior, utilization patterns, and patient mix to "
                "highlight unusual practices that may indicate fraud."
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
        """Evaluate provider metrics against dynamic peer-group statistics."""
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

        provider_score = score_from_evidence(
            evidence,
            base_score=0.2,
            evidence_weight=0.1,
            elevated_weight=0.05,
        )

        logger.debug(
            "Provider analysis for %s: score=%s evidence_count=%s",
            provider_row.get("Provider"),
            provider_score,
            len(evidence),
        )

        return {
            "agent": "provider",
            "risk_score": provider_score,
            "evidence": evidence,
        }
