from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from crewai import Task


class InvestigationTaskFactory:
    """Builds CrewAI Task instances for the fraud investigation workflow."""

    @staticmethod
    def create_provider_task(
        provider_row: dict[str, Any],
        reference_stats: dict[str, dict[str, float]],
        agent,
    ) -> "Task":
        from crewai import Task

        return Task(
            description=(
                f"Analyze provider {provider_row.get('Provider', 'unknown')} using provider-level billing and "
                f"utilization metrics. Provider metrics: {provider_row}. "
                f"Dynamic peer group statistics: {reference_stats}. "
                "Assess claim volume, average reimbursement, patient diversity, outpatient ratio, and growth in claims. "
                "Compare metrics against peer z-scores, 95th percentile, and mean + 2*std thresholds."
            ),
            expected_output=(
                "A structured provider analysis report identifying significant outliers and generating provider-level "
                "risk score and evidence details."
            ),
            agent=agent,
        )

    @staticmethod
    def create_claim_task(
        provider_row: dict[str, Any],
        reference_stats: dict[str, dict[str, float]],
        agent,
        context: "list[Task] | None" = None,
    ) -> "Task":
        from crewai import Task

        return Task(
            description=(
                f"Analyze claim patterns for provider {provider_row.get('Provider', 'unknown')}. "
                f"Identify duplicate claims, repeated diagnosis/procedure codes, claim frequency spikes, "
                f"and upcoding indicators. Compare metrics against dynamic peer group statistics: {reference_stats}."
            ),
            expected_output=(
                "A claims anomaly report detecting repeated codes, duplicate billings, temporal spikes, and upcoding, "
                "with risk score and evidence details."
            ),
            agent=agent,
            context=context or [],
        )

    @staticmethod
    def create_beneficiary_task(
        provider_row: dict[str, Any],
        reference_stats: dict[str, dict[str, float]],
        agent,
        context: "list[Task] | None" = None,
    ) -> "Task":
        from crewai import Task

        return Task(
            description=(
                f"Analyze beneficiary demographics and utilization concentration for provider "
                f"{provider_row.get('Provider', 'unknown')}. Assess repeat visits ratio, patient concentration, "
                f"chronic patient ratio, shared diagnosis clusters, and provider dependency. "
                f"Compare metrics against dynamic peer group statistics: {reference_stats}."
            ),
            expected_output=(
                "A beneficiary utilization report detailing patient concentration, chronic ratio, dependency, "
                "and sharing clusters, with risk score and evidence details."
            ),
            agent=agent,
            context=context or [],
        )

    @staticmethod
    def create_coordinator_task(
        provider_row: dict[str, Any],
        specialist_tasks: "list[Task]",
        fraud_probability: float,
        agent,
    ) -> "Task":
        from crewai import Task

        return Task(
            description=(
                f"Aggregate and compile findings for provider {provider_row.get('Provider', 'unknown')} using the outputs "
                f"from the provider task, claims task, and beneficiary task. Combine findings with the ML fraud prediction "
                f"probability of {fraud_probability}. Generate a finalized investigation report in structured JSON format "
                "with no conversational wrapper or markdown formatting outside of JSON."
            ),
            expected_output=(
                "A completed structured JSON report matching the schema: "
                '{"Fraud Score": ..., "Provider Risk": ..., "Claim Risk": ..., "Beneficiary Risk": ..., '
                '"Evidence": [...], "Recommendation": [...], "Priority": ..., "Confidence": ...}'
            ),
            agent=agent,
            context=specialist_tasks,
        )
