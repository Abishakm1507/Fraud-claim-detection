import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


class BackendIntegrationTests(unittest.TestCase):
    def test_investigation_endpoint_returns_report(self) -> None:
        client = TestClient(app)
        response = client.post("/investigate", json={"provider_id": "PRV51001"})
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["Provider"], "PRV51001")
        self.assertIn("investigation_summary", payload)
        self.assertIn("coordinator", payload["investigation_summary"])
        self.assertIn("reusable_agent_findings", payload)

    def test_predict_endpoint_returns_ensemble_prediction(self) -> None:
        """Verify /predict returns a valid ensemble prediction with expected fields."""
        client = TestClient(app)
        # Use a minimal feature set; missing features default to 0
        response = client.post("/predict", json={
            "provider_id": "PRV51001",
            "features": {"TotalClaims": 10, "UniquePatients": 5},
        })
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["provider_id"], "PRV51001")
        self.assertIn("fraud_score", payload)
        self.assertIn("prediction", payload)
        self.assertIn("risk_level", payload)
        self.assertIn(payload["risk_level"], ["High", "Medium", "Low"])
        self.assertIn(payload["prediction"], [0, 1])
        self.assertIsInstance(payload["fraud_score"], float)
