from __future__ import annotations

import base64
import io
import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

try:
    import shap
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    SHAP_AVAILABLE = True
except Exception:  # pragma: no cover - handled at runtime
    SHAP_AVAILABLE = False
    shap = None
    plt = None


class ExplainabilityService:
    """Reusable service for turning model explanations into structured payloads.

    Responsibilities:
      - Initializing the SHAP explainer (once, at startup)
      - Computing SHAP values for a provider
      - Ranking features by absolute SHAP contribution
      - Generating explanation summaries
      - Building structured explanation payloads
      - Generating SHAP plots (summary + waterfall) as base64 strings
    """

    def __init__(
        self,
        *,
        model: Any = None,
        scaler: Any = None,
        feature_names: list[str] | None = None,
        background_data: Any = None,
        ensemble_service: Any = None,
    ) -> None:
        self._logger = logger
        self._model = model
        self._scaler = scaler
        self._feature_names = feature_names or []
        self._background_data = background_data
        self._ensemble_service = ensemble_service
        self._explainer = None
        self._explainer_initialized = False
        self._explainer_type = "linear"

    # ------------------------------------------------------------------
    # SHAP explainer initialization
    # ------------------------------------------------------------------
    def initialize_explainer(self) -> bool:
        """Initialize the SHAP LinearExplainer once.

        Returns True if the explainer was successfully initialized,
        False otherwise (e.g., SHAP not installed or model missing).
        """
        if self._explainer_initialized:
            return True

        if not SHAP_AVAILABLE:
            self._logger.warning("SHAP is not available; explainer will not be initialized.")
            return False

        if self._model is None or self._scaler is None:
            self._logger.warning("Model or scaler is missing; cannot initialize SHAP explainer.")
            return False

        # Prefer XGBoost with TreeExplainer for better explainability.
        xgb_model = None
        if self._ensemble_service is not None:
            xgb_model = self._ensemble_service.models.get("xgboost")

        if xgb_model is not None:
            try:
                self._explainer = shap.TreeExplainer(xgb_model)
                self._explainer_initialized = True
                self._explainer_type = "tree"
                self._logger.info("SHAP TreeExplainer initialized for XGBoost.")
                return True
            except Exception as exc:
                self._logger.warning(
                    "Failed to initialize SHAP TreeExplainer for XGBoost: %s; "
                    "falling back to LinearExplainer.",
                    exc,
                )

        # Fallback: LinearExplainer for LogisticRegression.
        try:
            # For LogisticRegression, LinearExplainer uses the model coefficients.
            # It requires a masker (Independent, Partition, or Impute).
            if self._background_data is not None:
                masker = shap.maskers.Independent(self._background_data)
                self._explainer = shap.LinearExplainer(self._model, masker=masker)
            else:
                # Fallback: use the scaler-transformed identity as background.
                # This still produces correct SHAP values for a linear model.
                self._explainer = shap.LinearExplainer(
                    self._model,
                    masker=shap.maskers.Independent(
                        np.zeros((1, len(self._feature_names)))
                    ),
                )
            self._explainer_initialized = True
            self._explainer_type = "linear"
            self._logger.info("SHAP LinearExplainer initialized successfully.")
            return True
        except Exception as exc:
            self._logger.exception("Failed to initialize SHAP explainer: %s", exc)
            return False

    # ------------------------------------------------------------------
    # SHAP computation
    # ------------------------------------------------------------------
    def compute_shap_values(self, X_scaled: Any) -> Any | None:
        """Compute SHAP values for a scaled input matrix.

        Args:
            X_scaled: Scaled feature matrix (numpy array or DataFrame).

        Returns:
            SHAP values array, or None if computation fails.
        """
        if not self._explainer_initialized:
            if not self.initialize_explainer():
                return None

        try:
            shap_values = self._explainer.shap_values(X_scaled)
            return shap_values
        except Exception as exc:
            self._logger.exception("Failed to compute SHAP values: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Feature ranking
    # ------------------------------------------------------------------
    def rank_features(
        self,
        *,
        feature_names: list[str],
        shap_values: Any,
        feature_values: list[float] | None = None,
        baseline_values: list[float] | None = None,
    ) -> list[dict[str, Any]]:
        """Rank features by absolute SHAP value (descending).

        Args:
            feature_names: Ordered list of feature names.
            shap_values: SHAP values array (1D for a single sample).
            feature_values: Optional raw feature values aligned with feature_names.
            baseline_values: Optional baseline values aligned with feature_names.

        Returns:
            List of dicts with feature_name, shap_value, feature_value,
            baseline_value, contribution_direction, importance_rank.
        """
        shap_arr = np.asarray(shap_values).flatten()
        n = min(len(feature_names), len(shap_arr))

        ranked = []
        for i in range(n):
            shap_val = float(shap_arr[i])
            direction = "positive" if shap_val >= 0 else "negative"
            ranked.append(
                {
                    "feature_name": feature_names[i],
                    "shap_value": shap_val,
                    "feature_value": (
                        float(feature_values[i]) if feature_values and i < len(feature_values) else None
                    ),
                    "baseline_value": (
                        float(baseline_values[i]) if baseline_values and i < len(baseline_values) else None
                    ),
                    "contribution_direction": direction,
                    "importance_rank": 0,  # filled below
                }
            )

        # Sort by absolute SHAP value descending
        ranked.sort(key=lambda entry: abs(entry["shap_value"]), reverse=True)
        for index, entry in enumerate(ranked, start=1):
            entry["importance_rank"] = index

        return ranked

    # ------------------------------------------------------------------
    # Summary generation
    # ------------------------------------------------------------------
    def generate_summary(
        self,
        *,
        provider_id: str,
        prediction: str,
        probability: float,
        ranked_features: list[dict[str, Any]],
    ) -> str:
        """Generate a concise textual summary of the explanation."""
        if not ranked_features:
            return (
                f"Provider {provider_id} was evaluated with prediction '{prediction}' "
                f"at {probability:.2%} probability. No feature contributions were available."
            )

        top = ranked_features[0]
        top_name = top["feature_name"]
        top_shap = top["shap_value"]
        direction = "increasing" if top_shap >= 0 else "decreasing"

        summary = (
            f"Provider {provider_id} was predicted as '{prediction}' with a fraud "
            f"probability of {probability:.2%}. The most influential feature was "
            f"'{top_name}' with a SHAP contribution of {top_shap:+.4f}, "
            f"{direction} the fraud likelihood."
        )
        return summary

    # ------------------------------------------------------------------
    # Structured explanation payload
    # ------------------------------------------------------------------
    def build_explanation_payload(
        self,
        *,
        provider_id: str,
        prediction: str,
        probability: float,
        feature_contributions: list[dict[str, Any]],
        explanation_text: str,
        plot_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a structured explanation payload for downstream consumers.

        Args:
            provider_id: Provider identifier.
            prediction: Prediction label (e.g., "High", "Medium", "Low").
            probability: Fraud probability (0-1).
            feature_contributions: List of dicts with feature_name, shap_value,
                feature_value, baseline_value.
            explanation_text: Text summary / Gemini explanation.
            plot_config: Optional plot configuration dict.

        Returns:
            Dict with provider_id, prediction, probability, structured_explanation,
            and plots.
        """
        ranked_features = []
        for index, item in enumerate(feature_contributions, start=1):
            shap_value = float(item.get("shap_value", 0.0))
            contribution_direction = "positive" if shap_value >= 0 else "negative"
            ranked_features.append(
                {
                    "feature_name": item.get("feature_name") or item.get("feature") or "unknown",
                    "shap_value": shap_value,
                    "feature_value": item.get("feature_value"),
                    "baseline_value": item.get("baseline_value"),
                    "contribution_direction": contribution_direction,
                    "importance_rank": index,
                }
            )

        ranked_features.sort(key=lambda entry: abs(entry["shap_value"]), reverse=True)
        for index, entry in enumerate(ranked_features, start=1):
            entry["importance_rank"] = index

        return {
            "provider_id": provider_id,
            "prediction": prediction,
            "probability": round(float(probability), 4),
            "structured_explanation": {
                "summary": explanation_text,
                "features": ranked_features,
                "plot_config": plot_config or {},
            },
            "plots": {},
        }

    # ------------------------------------------------------------------
    # Plot generation
    # ------------------------------------------------------------------
    def build_plot_payload(
        self,
        *,
        explanation_payload: dict[str, Any],
        shap_values: Any = None,
        X_scaled: Any = None,
        feature_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate SHAP summary and waterfall plots as base64 strings.

        Args:
            explanation_payload: The structured explanation payload.
            shap_values: SHAP values array.
            X_scaled: Scaled feature matrix.
            feature_names: Feature names for the plots.

        Returns:
            Dict with summary_plot and waterfall_plot (base64 strings or None).
        """
        if not SHAP_AVAILABLE or shap_values is None or X_scaled is None:
            return {
                "summary_plot": None,
                "waterfall_plot": None,
                "source": explanation_payload,
            }

        names = feature_names or self._feature_names
        if not names:
            return {
                "summary_plot": None,
                "waterfall_plot": None,
                "source": explanation_payload,
            }

        try:
            summary_b64 = self._generate_summary_plot(shap_values, X_scaled, names)
            waterfall_b64 = self._generate_waterfall_plot(shap_values, X_scaled, names)
            return {
                "summary_plot": summary_b64,
                "waterfall_plot": waterfall_b64,
                "source": explanation_payload,
            }
        except Exception as exc:
            self._logger.exception("Failed to generate SHAP plots: %s", exc)
            return {
                "summary_plot": None,
                "waterfall_plot": None,
                "source": explanation_payload,
            }

    def _generate_summary_plot(self, shap_values: Any, X_scaled: Any, feature_names: list[str]) -> str | None:
        """Generate a SHAP summary plot and return it as a base64 string."""
        try:
            fig, ax = plt.subplots(figsize=(10, 6))
            shap.summary_plot(
                shap_values,
                X_scaled,
                feature_names=feature_names,
                show=False,
            )
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
            plt.close(fig)
            buf.seek(0)
            return base64.b64encode(buf.read()).decode("utf-8")
        except Exception as exc:
            self._logger.exception("Failed to generate summary plot: %s", exc)
            return None

    def _generate_waterfall_plot(self, shap_values: Any, X_scaled: Any, feature_names: list[str]) -> str | None:
        """Generate a SHAP waterfall plot and return it as a base64 string."""
        try:
            # shap_values may be a list (for multi-class) or a single array.
            if isinstance(shap_values, list):
                sv = shap_values[0]
            else:
                sv = shap_values

            # For a single sample, shap_values shape is (n_features,)
            # For multiple samples, take the first row.
            if sv.ndim > 1:
                sv = sv[0]

            x_row = np.asarray(X_scaled)
            if x_row.ndim > 1:
                x_row = x_row[0]

            # Build an Explanation object for the waterfall plot.
            explanation = shap.Explanation(
                values=sv,
                base_values=self._explainer.expected_value if self._explainer is not None else 0.0,
                data=x_row,
                feature_names=feature_names,
            )

            fig, ax = plt.subplots(figsize=(10, 6))
            shap.plots.waterfall(explanation, show=False, max_display=10)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
            plt.close(fig)
            buf.seek(0)
            return base64.b64encode(buf.read()).decode("utf-8")
        except Exception as exc:
            self._logger.exception("Failed to generate waterfall plot: %s", exc)
            return None