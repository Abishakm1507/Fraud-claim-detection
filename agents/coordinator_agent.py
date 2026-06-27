from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class InvestigationCoordinatorAgent:
    """Combines the specialist findings into an overall investigation report."""

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
            role="Investigation Coordinator",
            goal="Combine specialist findings into a structured fraud investigation report",
            backstory=(
                "You synthesize provider, claim, and beneficiary evidence into a concise investigation package "
                "that is ready for human review."
            ),
            verbose=False,
            allow_delegation=False,
                llm=llm,
            )
        return self._crew_agent

    def analyze(
        self,
        provider_row: dict[str, Any],
        specialist_findings: list[dict[str, Any]],
        fraud_probability: float,
    ) -> dict[str, Any]:
        """Aggregate specialist outputs into a structured investigation report."""
        provider_risk = 0.0
        claim_risk = 0.0
        beneficiary_risk = 0.0
        evidence: list[dict[str, Any]] = []

        for finding in specialist_findings:
            agent_type = finding.get("agent")
            risk = float(finding.get("risk_score", 0.0))
            if agent_type == "provider":
                provider_risk = risk
            elif agent_type == "claim":
                claim_risk = risk
            elif agent_type == "beneficiary":
                beneficiary_risk = risk
            evidence.extend(finding.get("evidence", []))

        specialist_avg = (provider_risk + claim_risk + beneficiary_risk) / 3.0
        combined_score = round(min(1.0, (specialist_avg * 0.7) + (fraud_probability * 0.3)), 3)

        if combined_score >= 0.8:
            priority = "High"
            recommendation = [
                "Escalate to manual audit immediately",
                "Suspend payments pending review",
                "Conduct comprehensive beneficiary interview",
                "Verify procedure code accuracy on inpatient billing",
            ]
        elif combined_score >= 0.6:
            priority = "Medium"
            recommendation = [
                "Perform targeted claims review on procedural codes",
                "Monitor claim volumes and patient-mix trends",
                "Request patient record samples for code validation",
            ]
        else:
            priority = "Low"
            recommendation = [
                "Continue baseline monitoring of billing patterns",
                "Re-evaluate during quarterly review cycles",
            ]

        confidence = round(min(0.99, 0.5 + (0.05 * len(evidence)) + (0.2 * fraud_probability)), 3)

        logger.debug(
            "Coordinator report for %s: fraud_score=%s priority=%s",
            provider_row.get("Provider"),
            combined_score,
            priority,
        )

        return {
            "Fraud Score": combined_score,
            "Provider Risk": provider_risk,
            "Claim Risk": claim_risk,
            "Beneficiary Risk": beneficiary_risk,
            "Evidence": evidence,
            "Recommendation": recommendation,
            "Priority": priority,
            "Confidence": confidence,
            "risk_score": combined_score,
            "risk_tier": priority.lower(),
            "agent": "coordinator",
            "fraud_probability": round(float(fraud_probability), 3),
            "recommended_actions": recommendation,
        }
