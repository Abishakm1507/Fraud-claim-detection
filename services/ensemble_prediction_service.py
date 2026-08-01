from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Default ensemble weights (configurable via constructor)
DEFAULT_WEIGHTS: dict[str, float] = {
    "logistic_regression": 0.20,
    "random_forest": 0.30,
    "xgboost": 0.50,
}

# Prediction threshold for binary classification
DEFAULT_THRESHOLD = 0.50

# Risk level thresholds
HIGH_RISK_THRESHOLD = 0.80
MEDIUM_RISK_THRESHOLD = 0.50


class EnsemblePredictionService:
    """Production-ready ensemble prediction engine.

    Loads Logistic Regression, Random Forest, and XGBoost models once at
    initialization, then combines their probabilities using weighted soft
    voting to produce a single unified fraud prediction.

    Responsibilities:
      - Loading all models, scaler, and feature names once at startup
      - Computing per-model fraud probabilities
      - Combining probabilities via weighted soft voting
      - Producing a final binary prediction and risk level
      - Gracefully falling back to available models if one fails
    """

    def __init__(
        self,
        *,
        model_dir: str | Path | None = None,
        weights: dict[str, float] | None = None,
        threshold: float = DEFAULT_THRESHOLD,
    ) -> None:
        self._logger = logger
        self._model_dir = Path(model_dir) if model_dir else Path(__file__).resolve().parents[1] / "models"
        self._weights = {**DEFAULT_WEIGHTS, **(weights or {})}
        self._threshold = threshold

        # Populated by load_models()
        self._models: dict[str, Any] = {}
        self._scaler: Any = None
        self._feature_names: list[str] = []

        self.load_models()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------
    def load_models(self) -> None:
        """Load all ensemble models, scaler, and feature names once.

        Each model is loaded independently so a failure in one does not
        prevent the others from being available.
        """
        model_files = {
            "logistic_regression": "logistic_regression.pkl",
            "random_forest": "random_forest.pkl",
            "xgboost": "xgboost.pkl",
        }

        for name, filename in model_files.items():
            try:
                path = self._model_dir / filename
                self._models[name] = joblib.load(path)
                self._logger.info("Loaded %s from %s", name, path)
            except Exception as exc:
                self._logger.error("Failed to load %s: %s", name, exc)

        # Scaler and feature names are required for preprocessing
        try:
            self._scaler = joblib.load(self._model_dir / "scaler.pkl")
            self._logger.info("Loaded scaler from %s", self._model_dir / "scaler.pkl")
        except Exception as exc:
            self._logger.error("Failed to load scaler: %s", exc)
            raise RuntimeError("Scaler is required for ensemble prediction") from exc

        try:
            self._feature_names = list(joblib.load(self._model_dir / "feature_names.pkl"))
            self._logger.info("Loaded %d feature names", len(self._feature_names))
        except Exception as exc:
            self._logger.error("Failed to load feature names: %s", exc)
            raise RuntimeError("Feature names are required for ensemble prediction") from exc

        if not self._models:
            raise RuntimeError("No ensemble models could be loaded")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def predict_probability(self, X: Any) -> float:
        """Return the weighted soft-voting fraud probability for a single sample.

        Args:
            X: Scaled feature matrix (numpy array or DataFrame) with one row.

        Returns:
            Float probability in [0, 1].
        """
        probabilities = self._compute_model_probabilities(X)
        return float(self._weighted_soft_vote(probabilities))

    def predict(self, X: Any) -> int:
        """Return the binary fraud prediction (0 or 1) for a single sample."""
        probability = self.predict_probability(X)
        return 1 if probability >= self._threshold else 0

    def predict_with_details(self, X: Any) -> dict[str, Any]:
        """Return a detailed prediction payload including per-model probabilities.

        Args:
            X: Scaled feature matrix (numpy array or DataFrame) with one row.

        Returns:
            Dict with:
              - probability: final weighted fraud probability
              - prediction: binary prediction (0 or 1)
              - risk_level: "High", "Medium", or "Low"
              - model_probabilities: per-model fraud probabilities
              - models_used: list of model names that contributed
        """
        probabilities = self._compute_model_probabilities(X)
        final_probability = float(self._weighted_soft_vote(probabilities))
        prediction = 1 if final_probability >= self._threshold else 0
        risk_level = self._risk_level(final_probability)

        return {
            "probability": final_probability,
            "prediction": prediction,
            "risk_level": risk_level,
            "model_probabilities": probabilities,
            "models_used": list(probabilities.keys()),
        }

    # ------------------------------------------------------------------
    # Preprocessing helpers
    # ------------------------------------------------------------------
    def preprocess(self, features: dict[str, Any] | pd.Series | pd.DataFrame) -> Any:
        """Build a scaled feature matrix from raw feature values.

        Accepts a dict, Series, or DataFrame and returns the scaled matrix
        in the correct feature order.
        """
        if isinstance(features, pd.DataFrame):
            input_data = [features.get(col, 0).iloc[0] if col in features.columns else 0 for col in self._feature_names]
        elif isinstance(features, pd.Series):
            input_data = [features.get(col, 0) for col in self._feature_names]
        else:
            input_data = [features.get(col, 0) for col in self._feature_names]

        X = pd.DataFrame([input_data], columns=self._feature_names)
        return self._scaler.transform(X)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _compute_model_probabilities(self, X: Any) -> dict[str, float]:
        """Compute fraud probability from each available model.

        If a model fails, it is skipped and the error is logged. The
        remaining models are used for the weighted vote.
        """
        probabilities: dict[str, float] = {}

        for name, model in self._models.items():
            try:
                proba = model.predict_proba(X)
                # Handle both binary and multi-class outputs
                if proba.ndim == 2 and proba.shape[1] >= 2:
                    probabilities[name] = float(proba[0][1])
                else:
                    probabilities[name] = float(proba[0])
            except Exception as exc:
                self._logger.error("Model %s failed during predict_proba: %s", name, exc)

        if not probabilities:
            raise RuntimeError("All ensemble models failed during prediction")

        return probabilities

    def _weighted_soft_vote(self, probabilities: dict[str, float]) -> float:
        """Combine per-model probabilities using weighted soft voting.

        Weights are renormalized to the available models so the final
        probability remains in [0, 1] even when a model is unavailable.
        """
        available_weights = {
            name: self._weights.get(name, 0.0)
            for name in probabilities
        }
        total_weight = sum(available_weights.values())
        if total_weight <= 0:
            # Fall back to equal weighting if configured weights are invalid
            total_weight = float(len(probabilities))
            available_weights = {name: 1.0 for name in probabilities}

        weighted_sum = sum(
            probabilities[name] * (weight / total_weight)
            for name, weight in available_weights.items()
        )
        return float(np.clip(weighted_sum, 0.0, 1.0))

    @staticmethod
    def _risk_level(probability: float) -> str:
        """Map a fraud probability to a risk level."""
        if probability >= HIGH_RISK_THRESHOLD:
            return "High"
        if probability >= MEDIUM_RISK_THRESHOLD:
            return "Medium"
        return "Low"

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def models(self) -> dict[str, Any]:
        """Return the loaded models."""
        return self._models

    @property
    def scaler(self) -> Any:
        """Return the loaded scaler."""
        return self._scaler

    @property
    def feature_names(self) -> list[str]:
        """Return the loaded feature names."""
        return self._feature_names

    @property
    def weights(self) -> dict[str, float]:
        """Return the configured ensemble weights."""
        return dict(self._weights)