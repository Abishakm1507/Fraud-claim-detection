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


class ClaimAnalysisAgent:
    """Analyses claim pattern anomalies across providers."""

    METRICS: list[str] = [
        "AvgClaimDuration",
        "MaxClaimDuration",
        "AvgDaysInHospital",
        "TotalDaysInHospital",
        "AvgReimbursed",
        "MaxReimbursed",
        "AvgDeductible",
        "TotalDeductible",
        "DuplicateClaimsRatio",
        "TopDiagnosisCodeRatio",
        "TopProcedureCodeRatio",
        "MaxClaimsSingleDay",
    ]

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
            role="Claim Pattern Analyst",
            goal="Detect unusual claim-level patterns that are consistent with fraudulent billing",
            backstory=(
                "You examine reimbursement intensity, claim duration, and claim mix to find patterns "
                "that stand out from the rest of the provider population."
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
        """Detect claim-level anomalies using dynamic peer thresholds."""
        evidence: list[dict[str, Any]] = []

        for metric in self.METRICS:
            value = provider_row.get(metric)
            if value is None or not isinstance(value, (int, float)):
                continue

            ref = reference_stats.get(metric)
            if not ref:
                continue

            signal = is_metric_elevated(float(value), ref, direction="high")
            if signal:
                evidence.append(build_evidence_item(metric, float(value), ref, signal))

        claim_score = score_from_evidence(
            evidence,
            base_score=0.2,
            evidence_weight=0.12,
        )

        logger.debug(
            "Claim analysis for %s: score=%s evidence_count=%s",
            provider_row.get("Provider"),
            claim_score,
            len(evidence),
        )

        return {
            "agent": "claim",
            "risk_score": claim_score,
            "evidence": evidence,
        }
