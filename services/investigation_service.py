from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from agents.investigation.base import InvestigationContext
from agents.investigation.beneficiary_agent import BeneficiaryInvestigationAgent
from agents.investigation.claim_agent import ClaimInvestigationAgent
from agents.investigation.provider_agent import ProviderInvestigationAgent
from crews.fraud_investigation_crew import FraudInvestigationCrew
from services.agent_registry import AgentRegistry
from services.ensemble_prediction_service import EnsemblePredictionService
from services.investigation_orchestrator import InvestigationOrchestrator
from utils.investigation_utils import create_probability_frame

logger = logging.getLogger(__name__)


class InvestigationService:
    """Business logic for running the provider investigation workflow."""

    def __init__(self, output_dir: str | None = None, project_root: str | None = None) -> None:
        self.project_root = Path(project_root or Path(__file__).resolve().parents[1])
        self.output_dir = Path(output_dir or self.project_root / "outputs")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.model_dir = self.project_root / "models"
        self.provider_data_path = self.project_root / "notebooks" / "provider_master.csv"
        self.ensemble_service = EnsemblePredictionService(model_dir=self.model_dir)
        self.model = self.ensemble_service.models.get("logistic_regression")
        self.scaler = self.ensemble_service.scaler
        self.feature_names = self.ensemble_service.feature_names
        self.orchestrator = InvestigationOrchestrator()
        self.agent_registry = AgentRegistry()
        self.agent_registry.register("provider", lambda: ProviderInvestigationAgent())
        self.agent_registry.register("claim", lambda: ClaimInvestigationAgent())
        self.agent_registry.register("beneficiary", lambda: BeneficiaryInvestigationAgent())
        self.reusable_agent_names = ["provider", "claim", "beneficiary"]

    def _load_provider_frame(self) -> pd.DataFrame:
        provider_df = pd.read_csv(self.provider_data_path)
        if "Provider" not in provider_df.columns:
            raise ValueError("provider_master.csv is missing the Provider column")
        return provider_df

    def _build_feature_frame(self, provider_row: pd.Series) -> pd.DataFrame:
        feature_values = [provider_row.get(feature, 0) for feature in self.feature_names]
        return pd.DataFrame([feature_values], columns=self.feature_names)

    def _generate_fraud_probabilities(self, provider_df: pd.DataFrame) -> pd.DataFrame:
        probabilities: list[float] = []
        for _, row in provider_df.iterrows():
            features = self._build_feature_frame(row)
            scaled = self.scaler.transform(features)
            scaled_frame = pd.DataFrame(scaled, columns=self.feature_names)
            probability = self.ensemble_service.predict_probability(scaled_frame)
            probabilities.append(probability)

        return create_probability_frame(provider_df, probabilities)

    def investigate_provider(self, provider_id: str, threshold: float = 0.6) -> dict[str, Any]:
        """Load a provider, score it with the ML model, and run the investigation crew."""
        provider_df = self._load_provider_frame()
        provider_df["Provider"] = provider_df["Provider"].astype(str)

        provider_row = provider_df[provider_df["Provider"] == provider_id]
        if provider_row.empty:
            raise ValueError(f"Provider {provider_id} was not found")

        provider_row = provider_row.iloc[[0]].copy()
        fraud_probabilities = self._generate_fraud_probabilities(provider_row)

        crew = FraudInvestigationCrew(output_dir=str(self.output_dir))
        threshold_for_run = 0.0 if provider_id else threshold
        reports = crew.investigate(provider_row, fraud_probabilities, threshold=threshold_for_run)
        if not reports:
            raise RuntimeError("Investigation crew returned no reports")

        report = reports[0]
        coordinator_payload = report["investigation_summary"]["coordinator"]
        report["follow_up_steps"] = self.orchestrator.build_follow_up_steps(coordinator_payload)

        context = InvestigationContext(
            provider_id=provider_id,
            provider_row=provider_row.iloc[0].to_dict(),
            cohort_context=coordinator_payload.get("cohort_context", {}),
            temporal_context=coordinator_payload.get("temporal_context", {}),
            ml_probability=float(report.get("fraud_probability", 0.0) or 0.0),
        )
        reusable_findings: list[dict[str, Any]] = []
        for agent_name in self.reusable_agent_names:
            try:
                agent = self.agent_registry.create(agent_name)
                reusable_findings.extend(agent.analyze(context))
            except KeyError:
                logger.warning("Investigation agent %s is not registered", agent_name)
        report["reusable_agent_findings"] = reusable_findings
        logger.info("Investigation completed for %s", provider_id)
        return report
