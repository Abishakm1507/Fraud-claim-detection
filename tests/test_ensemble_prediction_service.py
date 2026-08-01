import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ensemble_prediction_service import (
    DEFAULT_WEIGHTS,
    EnsemblePredictionService,
)


class MockModel:
    """Simple mock model that returns configurable probabilities."""

    def __init__(self, probability: float) -> None:
        self._probability = probability

    def predict_proba(self, X):
        return np.array([[1.0 - self._probability, self._probability]])

    def predict(self, X):
        return np.array([1 if self._probability >= 0.5 else 0])


class EnsemblePredictionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        # Create a temporary model directory with mock models
        self.model_dir = ROOT / "models"

    def test_all_three_models_are_loaded(self) -> None:
        """Verify all three models are loaded from the real model directory."""
        service = EnsemblePredictionService(model_dir=self.model_dir)
        self.assertIn("logistic_regression", service.models)
        self.assertIn("random_forest", service.models)
        self.assertIn("xgboost", service.models)
        self.assertIsNotNone(service.scaler)
        self.assertGreater(len(service.feature_names), 0)

    def test_weighted_probability_is_computed_correctly(self) -> None:
        """Verify weighted soft voting produces the expected probability."""
        service = EnsemblePredictionService.__new__(EnsemblePredictionService)
        service._weights = dict(DEFAULT_WEIGHTS)
        service._logger = MagicMock()

        probabilities = {
            "logistic_regression": 0.2,
            "random_forest": 0.4,
            "xgboost": 0.6,
        }
        expected = 0.20 * 0.2 + 0.30 * 0.4 + 0.50 * 0.6
        result = service._weighted_soft_vote(probabilities)
        self.assertAlmostEqual(result, expected, places=6)

    def test_weighted_probability_renormalizes_when_model_missing(self) -> None:
        """Verify weights are renormalized when a model is unavailable."""
        service = EnsemblePredictionService.__new__(EnsemblePredictionService)
        service._weights = dict(DEFAULT_WEIGHTS)
        service._logger = MagicMock()

        # Only LR and RF available
        probabilities = {
            "logistic_regression": 0.2,
            "random_forest": 0.4,
        }
        # Renormalized weights: 0.20/0.50, 0.30/0.50
        expected = (0.20 / 0.50) * 0.2 + (0.30 / 0.50) * 0.4
        result = service._weighted_soft_vote(probabilities)
        self.assertAlmostEqual(result, expected, places=6)

    def test_prediction_threshold_works(self) -> None:
        """Verify binary prediction threshold at 0.50."""
        service = EnsemblePredictionService.__new__(EnsemblePredictionService)
        service._weights = dict(DEFAULT_WEIGHTS)
        service._threshold = 0.50
        service._logger = MagicMock()

        # Above threshold -> 1
        service._compute_model_probabilities = MagicMock(
            return_value={
                "logistic_regression": 0.6,
                "random_forest": 0.6,
                "xgboost": 0.6,
            }
        )
        self.assertEqual(service.predict(np.zeros((1, 5))), 1)

        # Below threshold -> 0
        service._compute_model_probabilities = MagicMock(
            return_value={
                "logistic_regression": 0.4,
                "random_forest": 0.4,
                "xgboost": 0.4,
            }
        )
        self.assertEqual(service.predict(np.zeros((1, 5))), 0)

        # Exactly at threshold -> 1
        service._compute_model_probabilities = MagicMock(
            return_value={
                "logistic_regression": 0.5,
                "random_forest": 0.5,
                "xgboost": 0.5,
            }
        )
        self.assertEqual(service.predict(np.zeros((1, 5))), 1)

    def test_risk_level_mapping(self) -> None:
        """Verify risk level thresholds."""
        self.assertEqual(EnsemblePredictionService._risk_level(0.85), "High")
        self.assertEqual(EnsemblePredictionService._risk_level(0.80), "High")
        self.assertEqual(EnsemblePredictionService._risk_level(0.65), "Medium")
        self.assertEqual(EnsemblePredictionService._risk_level(0.50), "Medium")
        self.assertEqual(EnsemblePredictionService._risk_level(0.30), "Low")

    def test_fallback_when_one_model_unavailable(self) -> None:
        """Verify graceful fallback when one model fails during prediction."""
        service = EnsemblePredictionService.__new__(EnsemblePredictionService)
        service._weights = dict(DEFAULT_WEIGHTS)
        service._threshold = 0.50
        service._logger = MagicMock()

        # XGBoost fails, LR and RF succeed
        def mock_compute(X):
            probabilities = {
                "logistic_regression": 0.2,
                "random_forest": 0.4,
            }
            return probabilities

        service._compute_model_probabilities = mock_compute
        result = service.predict_with_details(np.zeros((1, 5)))
        self.assertIn("logistic_regression", result["model_probabilities"])
        self.assertIn("random_forest", result["model_probabilities"])
        self.assertNotIn("xgboost", result["model_probabilities"])
        self.assertIn("probability", result)
        self.assertIn("prediction", result)
        self.assertIn("risk_level", result)

    def test_predict_with_details_returns_all_fields(self) -> None:
        """Verify predict_with_details returns the expected structure."""
        service = EnsemblePredictionService.__new__(EnsemblePredictionService)
        service._weights = dict(DEFAULT_WEIGHTS)
        service._logger = MagicMock()
        service._threshold = 0.50

        service._compute_model_probabilities = MagicMock(
            return_value={
                "logistic_regression": 0.2,
                "random_forest": 0.4,
                "xgboost": 0.6,
            }
        )
        result = service.predict_with_details(np.zeros((1, 5)))
        self.assertIn("probability", result)
        self.assertIn("prediction", result)
        self.assertIn("risk_level", result)
        self.assertIn("model_probabilities", result)
        self.assertIn("models_used", result)
        self.assertEqual(len(result["models_used"]), 3)

    def test_preprocess_builds_scaled_frame(self) -> None:
        """Verify preprocess builds a correctly ordered scaled DataFrame."""
        service = EnsemblePredictionService(model_dir=self.model_dir)
        features = {name: 1.0 for name in service.feature_names}
        X_scaled = service.preprocess(features)
        self.assertEqual(X_scaled.shape, (1, len(service.feature_names)))

    def test_weights_are_configurable(self) -> None:
        """Verify custom weights override defaults."""
        custom_weights = {
            "logistic_regression": 0.1,
            "random_forest": 0.2,
            "xgboost": 0.7,
        }
        service = EnsemblePredictionService(
            model_dir=self.model_dir,
            weights=custom_weights,
        )
        self.assertEqual(service.weights["logistic_regression"], 0.1)
        self.assertEqual(service.weights["random_forest"], 0.2)
        self.assertEqual(service.weights["xgboost"], 0.7)


if __name__ == "__main__":
    unittest.main()