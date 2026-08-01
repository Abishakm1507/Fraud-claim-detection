import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app
from services.explainability_service import ExplainabilityService


class ExplainabilityServiceTests(unittest.TestCase):
    def test_structured_explanation_includes_ranked_features(self) -> None:
        service = ExplainabilityService()
        payload = service.build_explanation_payload(
            provider_id="PRV10019",
            prediction="Fraud",
            probability=0.94,
            feature_contributions=[
                {
                    "feature_name": "num_inpatient_claims",
                    "shap_value": 0.45,
                    "feature_value": 12,
                    "baseline_value": 0.0,
                },
                {
                    "feature_name": "total_reimbursement",
                    "shap_value": 0.30,
                    "feature_value": 14200,
                    "baseline_value": 0.0,
                },
            ],
            explanation_text="Example explanation",
        )

        self.assertEqual(payload["provider_id"], "PRV10019")
        features = payload["structured_explanation"]["features"]
        self.assertEqual(features[0]["feature_name"], "num_inpatient_claims")
        self.assertEqual(features[0]["importance_rank"], 1)
        self.assertEqual(features[0]["contribution_direction"], "positive")
        self.assertEqual(features[1]["importance_rank"], 2)
        self.assertIn("feature_name", features[0])

    def test_explain_endpoint_returns_structured_explanation(self) -> None:
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertIn("structured_explanation", payload)
        self.assertIn("features", payload["structured_explanation"])
        self.assertGreaterEqual(len(payload["structured_explanation"]["features"]), 1)
        first_feature = payload["structured_explanation"]["features"][0]
        self.assertIn("feature_name", first_feature)
        self.assertIn("shap_value", first_feature)
        self.assertIn("contribution_direction", first_feature)

    def test_explain_endpoint_returns_http_200(self) -> None:
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)

    def test_explain_endpoint_returns_all_required_fields(self) -> None:
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        expected_fields = [
            "provider_id",
            "fraud_score",
            "prediction",
            "risk_level",
            "top_features",
            "feature_importance",
            "structured_explanation",
            "plots",
            "report_generation",
            "explanation_generation",
        ]
        for field in expected_fields:
            self.assertIn(field, payload, f"Missing field: {field}")

    def test_explain_endpoint_returns_real_shap_values(self) -> None:
        """Verify SHAP values are real (not the placeholder abs(scaled)*0.1 heuristic)."""
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        features = payload["structured_explanation"]["features"]
        self.assertGreaterEqual(len(features), 1)

        # Real SHAP values should not all be tiny multiples of 0.1
        shap_values = [abs(f["shap_value"]) for f in features]
        self.assertGreater(max(shap_values), 0.1, "SHAP values look like placeholders")

        # Each feature should have contribution_direction and importance_rank
        for feature in features:
            self.assertIn("contribution_direction", feature)
            self.assertIn("importance_rank", feature)
            self.assertIn("feature_value", feature)
            self.assertIn("baseline_value", feature)

    def test_explain_endpoint_features_ranked_by_abs_shap(self) -> None:
        """Verify features are ranked by absolute SHAP value descending."""
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        features = payload["structured_explanation"]["features"]
        shap_values = [abs(f["shap_value"]) for f in features]
        self.assertEqual(shap_values, sorted(shap_values, reverse=True),
                         "Features are not ranked by absolute SHAP value descending")

        # importance_rank should be sequential starting at 1
        for i, feature in enumerate(features, start=1):
            self.assertEqual(feature["importance_rank"], i)

    def test_explain_endpoint_generates_summary_plot(self) -> None:
        """Verify the SHAP summary plot is generated as base64."""
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        plots = payload.get("plots", {})
        self.assertIn("summary_plot", plots)
        summary_plot = plots.get("summary_plot")
        if summary_plot:
            self.assertGreater(len(summary_plot), 100, "Summary plot base64 is too short")
        else:
            # If SHAP is unavailable, fallback should be flagged
            self.assertTrue(payload.get("explanation_generation", {}).get("fallback_used", False))

    def test_explain_endpoint_generates_waterfall_plot(self) -> None:
        """Verify the SHAP waterfall plot is generated as base64."""
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        plots = payload.get("plots", {})
        self.assertIn("waterfall_plot", plots)
        waterfall_plot = plots.get("waterfall_plot")
        if waterfall_plot:
            self.assertGreater(len(waterfall_plot), 100, "Waterfall plot base64 is too short")
        else:
            # If SHAP is unavailable, fallback should be flagged
            self.assertTrue(payload.get("explanation_generation", {}).get("fallback_used", False))

    def test_explain_endpoint_report_generation_still_works(self) -> None:
        """Verify report generation continues to work."""
        client = TestClient(app)
        response = client.get("/explain/PRV51001")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        report_generation = payload.get("report_generation", {})
        self.assertIn("markdown_report", report_generation)
        self.assertIn("structured_report", report_generation)
        self.assertGreater(len(report_generation.get("markdown_report", "")), 0)

    def test_explain_endpoint_unknown_provider_returns_error(self) -> None:
        client = TestClient(app)
        response = client.get("/explain/UNKNOWN_PROVIDER_XYZ")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertIn("error", payload)

    def test_rank_features_sorts_by_abs_shap_descending(self) -> None:
        service = ExplainabilityService()
        ranked = service.rank_features(
            feature_names=["a", "b", "c"],
            shap_values=[0.1, -0.5, 0.3],
            feature_values=[1, 2, 3],
            baseline_values=[0, 0, 0],
        )
        self.assertEqual(ranked[0]["feature_name"], "b")
        self.assertEqual(ranked[0]["importance_rank"], 1)
        self.assertEqual(ranked[0]["contribution_direction"], "negative")
        self.assertEqual(ranked[1]["feature_name"], "c")
        self.assertEqual(ranked[2]["feature_name"], "a")

    def test_generate_summary_uses_top_feature(self) -> None:
        service = ExplainabilityService()
        summary = service.generate_summary(
            provider_id="PRV1",
            prediction="High",
            probability=0.85,
            ranked_features=[
                {
                    "feature_name": "TotalClaims",
                    "shap_value": 0.45,
                    "importance_rank": 1,
                }
            ],
        )
        self.assertIn("PRV1", summary)
        self.assertIn("TotalClaims", summary)
        self.assertIn("0.45", summary)


if __name__ == "__main__":
    unittest.main()