"""Explainability report generator using Google Gemini (gemini-2.5-flash).

This script builds a detailed prompt from ML model outputs and provider data,
queries Gemini via the google-generativeai SDK, and prints a professional,
auditor-ready explanation for why a provider was flagged as fraudulent or
suspicious.

Usage (examples):
  python explainability.py --provider-id PRV10019 --prediction Fraud \
      --probability 0.948 --top-features "num_inpatient_claims,total_reimbursement,duplicate_claims" \
      --shap shaps.json --claim-stats claim_stats.json --anomalies anomalies.json

Requirements:
  - Set environment variable `GOOGLE_API_KEY` with your Gemini API key.
  - Install `google-generativeai` (the google-generativeai Python SDK).

This file defines:
  - configure_gemini()
  - build_prompt()
  - generate_explanation()
  - main()

Follow PEP 8 and include type hints and docstrings.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

_DRY_IMPORT_SKIP = os.getenv("GOOGLE_API_KEY") == "DUMMY_KEY"
genai = None
Client = None
if not _DRY_IMPORT_SKIP:
    try:
        import google.genai as genai  # type: ignore
        from google.genai import Client  # type: ignore
        genai_module_name = "google.genai"
    except Exception as exc:  # pragma: no cover - handled at runtime
        raise RuntimeError(
            "The `google.genai` SDK is required. Install it with `pip install google-genai`."
        ) from exc
else:
    # In dry-run mode we skip importing the real SDK so tests can run without it.
    genai = None
    Client = None
    genai_module_name = None

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def configure_gemini() -> None:
    """Configure the Google Gemini client using the `GOOGLE_API_KEY` environment variable.

    Raises:
        RuntimeError: If the SDK is not installed or the API key is missing.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if genai is None:
        raise RuntimeError(
            "google.genai SDK is not available. Install it with `pip install google-genai`."
        )
    if not api_key:
        raise RuntimeError(
            "Environment variable GOOGLE_API_KEY is not set. Provide your Gemini API key."
        )

    # The google.genai SDK is configured by passing api_key to the Client.
    if not hasattr(genai, 'Client') and Client is None:
        raise RuntimeError(
            "google.genai SDK does not expose Client. Ensure google-genai is installed correctly."
        )
    # Log a masked preview of the key for debugging without exposing the secret.
    masked = api_key[:6] + "..." if len(api_key) > 6 else "***"
    logger.info(
        "google.genai is available and will use Client(api_key=%s) for requests", masked
    )


def _load_json_file(path: str) -> Any:
    """Load JSON content from a file and return the parsed object.

    Args:
        path: Path to the JSON file.

    Returns:
        The parsed JSON object.
    """
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def build_prompt(
    provider_id: str,
    prediction: str,
    probability: float,
    top_features: Optional[List[str]] = None,
    shap_values: Optional[Dict[str, float]] = None,
    claim_stats: Optional[Dict[str, Any]] = None,
    anomalies: Optional[Dict[str, Any]] = None,
) -> str:
    """Construct a detailed prompt for Gemini containing all inputs.

    The prompt instructs Gemini to produce structured sections required by the
    explainability report.

    Args:
        provider_id: Provider identifier.
        prediction: "Fraud" or "Non-Fraud" (case-insensitive accepted).
        probability: Fraud probability as a float between 0 and 1 (or 0-100).
        top_features: List of top ML features contributing to the prediction.
        shap_values: Optional mapping of feature -> SHAP value.
        claim_stats: Optional statistics about the provider's claims.
        anomalies: Optional anomaly detection results.

    Returns:
        A string prompt to send to Gemini.
    """
    # Normalize probability to percentage if needed
    prob = float(probability)
    if prob <= 1.0:
        prob_pct = prob * 100.0
    else:
        prob_pct = prob

    top_features_text = (
        "\n".join(f"- {f}" for f in top_features) if top_features else "(none provided)"
    )

    shap_text = "(not provided)"
    if shap_values:
        lines = [f"- {k}: {v:+.4f}" for k, v in sorted(shap_values.items(), key=lambda x: -abs(x[1]))]
        shap_text = "\n".join(lines)

    claim_stats_text = "(not provided)"
    if claim_stats:
        # pretty format claim stats as bullet list
        lines: List[str] = []
        for k, v in claim_stats.items():
            lines.append(f"- {k}: {v}")
        claim_stats_text = "\n".join(lines)

    anomalies_text = "(not provided)"
    if anomalies:
        try:
            # try to present anomaly dict in readable bullet form
            lines = [f"- {k}: {v}" for k, v in anomalies.items()]
            anomalies_text = "\n".join(lines)
        except Exception:
            anomalies_text = str(anomalies)

    prompt = f"""
You are an expert explainability assistant for an insurance fraud detection system.
Produce a professional, clear, and auditor-ready explainability report based on the
information provided below. Use non-technical language when possible, but include
concise technical details where they add value for auditors.

Input data:
- Provider ID: {provider_id}
- Prediction: {prediction}
- Fraud Probability: {prob_pct:.2f}%

Top ML Features (most influential):
{top_features_text}

SHAP Values (feature contributions to the prediction):
{shap_text}

Claim Statistics:
{claim_stats_text}

Anomaly Detection Results:
{anomalies_text}

Please produce the following sections in the response. Use clear headers and
bulleted lists where appropriate.

1) Executive Summary: A 2-4 sentence summary suitable for senior auditors.
2) Provider Overview: Short description of the provider and relevant claims context.
3) Prediction Explanation: Why the model produced the prediction (connect features to outcome).
4) Top Risk Factors: A concise bullet list of the highest-risk items supporting the prediction.
5) Feature Importance Explanation: Explain the role of each top feature and SHAP contributions.
6) Business Interpretation: What these signals mean for fraud investigators and auditors.
7) Confidence Level: Interpret the provided probability and any caveats (data quality, model limits).
8) Suggested Investigation Steps: Practical next steps for human investigators.
9) Final Conclusion: Short, actionable closing statement.

Keep the language professional, objective, and non-accusatory. When the prediction
is "Non-Fraud", focus on why the model is confident and what signals were reassuring.
When the prediction is "Fraud", emphasize evidence and suggested verification steps.

Return the result as plain text with the requested sections.
"""

    return prompt.strip()


def generate_explanation(prompt: str, max_output_tokens: int = 800) -> str:
    """Call Gemini to generate an explainability report for the constructed prompt.

    Args:
        prompt: The text prompt to send to Gemini.
        max_output_tokens: Maximum tokens to request from the model.

    Returns:
        The model's generated text as a string.

    Raises:
        RuntimeError: For API or SDK related failures with an explanatory message.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    # If running in a local dry-run mode, return a canned example instead of calling the API.
    if api_key == "DUMMY_KEY":
        # Produce a small, well-structured mock explanation to allow testing.
        return (
            "Executive Summary:\n"
            "The model flagged this provider due to multiple anomalous billing patterns and unusually high reimbursements.\n\n"
            "Provider Overview:\n"
            "Provider PRV10019 has an above-average number of inpatient claims and several reimbursement outliers.\n\n"
            "Prediction Explanation:\n"
            "Model prediction: Fraud. High SHAP contributions from `num_inpatient_claims` and `total_reimbursement` pushed the score toward fraud.\n\n"
            "Top Risk Factors:\n"
            "- High number of inpatient claims\n- Abnormally high reimbursement amounts\n- Duplicate billing patterns\n\n"
            "Feature Importance Explanation:\n"
            "Features `num_inpatient_claims` and `total_reimbursement` had the largest positive SHAP values, indicating strong influence toward the fraud prediction.\n\n"
            "Business Interpretation:\n"
            "These signals suggest billing behavior inconsistent with peers and warrant manual review.\n\n"
            "Confidence Level:\n"
            "The model reports a high probability for fraud; verify data quality and check for known edge-cases before action.\n\n"
            "Suggested Investigation Steps:\n"
            "1) Pull detailed claim histories; 2) Check for duplicate claim IDs; 3) Contact provider for supporting documentation.\n\n"
            "Final Conclusion:\n"
            "Recommend opening a formal investigation to validate the anomalous charges and determine corrective actions."
        )

    # Now require the SDK to be present (not dry-run)
    if genai is None or Client is None:
        raise RuntimeError("google.genai SDK is not available in this environment.")

    try:
        client = Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"parts": [{"text": prompt}]}],
            config={"max_output_tokens": max_output_tokens, "temperature": 0.2},
        )
    except Exception as exc:
        raise RuntimeError(f"google.genai call failed: {exc}") from exc

    try:
        # The response is a pydantic model with `text` and `candidates`.
        if hasattr(response, "text") and response.text:
            return response.text

        if hasattr(response, "candidates") and response.candidates:
            first = response.candidates[0]
            if hasattr(first, "content") and first.content:
                content = first.content
                if hasattr(content, "text") and content.text:
                    return content.text
                if hasattr(content, "parts") and content.parts:
                    part = content.parts[0]
                    if hasattr(part, "text") and part.text:
                        return part.text

        if hasattr(response, "json"):
            return response.json()

        return str(response)
    except Exception:
        return str(response)


def _print_report(provider_id: str, prediction: str, probability: float, report_text: str) -> None:
    """Print the explainability report in a clean, auditor-friendly format.

    Args:
        provider_id: Provider identifier.
        prediction: Model prediction label.
        probability: Probability value (0-100 scale expected by caller).
        report_text: The raw text generated by Gemini.
    """
    sep = "=" * 50
    print(sep)
    print("          FRAUD EXPLAINABILITY REPORT")
    print(sep)
    print()
    print(f"Provider ID: {provider_id}\n")
    print("Prediction:")
    print(prediction)
    print()
    print("Fraud Probability:")
    print(f"{probability:.1f}%")
    print()
    # Print the model output trimmed and as provided
    print(report_text)
    print()
    print(sep)


def _write_json_report(output_path: str, provider_id: str, prediction: str, probability: float, report_text: str) -> None:
    """Write or merge the explainability report into an existing JSON schema."""
    payload = {
        "Provider": provider_id,
        "fraud_probability": round(probability, 4),
        "explainability_report": report_text,
        "explainability": {
            "prediction": prediction,
            "probability": round(probability, 4),
            "model": "gemini-2.5-flash",
        },
    }

    merged = payload
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as existing_file:
                existing = json.load(existing_file)
            if isinstance(existing, dict):
                existing.update(payload)
                merged = existing
            else:
                merged = payload
        except Exception:
            merged = payload

    out_dir = os.path.dirname(output_path)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as out_file:
        json.dump(merged, out_file, indent=2, ensure_ascii=False)


def main(argv: Optional[List[str]] = None) -> int:
    """Main entry point.

    Parses arguments, configures Gemini, builds the prompt, calls the model, and
    prints the resulting explainability report.

    Returns:
        Exit code (0 success, non-zero error).
    """
    parser = argparse.ArgumentParser(description="Generate fraud explainability report using Gemini.")
    parser.add_argument("--provider-id", required=True, help="Provider identifier")
    parser.add_argument("--prediction", required=True, choices=["Fraud", "Non-Fraud", "fraud", "non-fraud"], help="Model prediction")
    parser.add_argument("--probability", required=True, type=float, help="Fraud probability (0-1 or 0-100)")
    parser.add_argument("--top-features", help="Comma-separated list of top ML features")
    parser.add_argument("--shap", help="Path to JSON file containing SHAP values (feature->value)")
    parser.add_argument("--claim-stats", help="Path to JSON file containing claim statistics")
    parser.add_argument("--anomalies", help="Path to JSON file containing anomaly detection results")
    parser.add_argument("--max-tokens", type=int, default=800, help="Maximum tokens for Gemini output")
    parser.add_argument("--dry-run", action="store_true", help="Run locally without calling Gemini (mock output)")
    parser.add_argument("--output", help="Path to write JSON report output (default: outputs/PRV<id>_report.json)")

    args = parser.parse_args(argv)

    # Parse list arguments
    top_features = None
    if args.top_features:
        top_features = [f.strip() for f in args.top_features.split(",") if f.strip()]

    shap_values = None
    if args.shap:
        try:
            shap_values = _load_json_file(args.shap)
        except Exception as exc:
            print(f"Failed to load SHAP file {args.shap}: {exc}", file=sys.stderr)
            return 2

    claim_stats = None
    if args.claim_stats:
        try:
            claim_stats = _load_json_file(args.claim_stats)
        except Exception as exc:
            print(f"Failed to load claim stats file {args.claim_stats}: {exc}", file=sys.stderr)
            return 3

    anomalies = None
    if args.anomalies:
        try:
            anomalies = _load_json_file(args.anomalies)
        except Exception as exc:
            print(f"Failed to load anomalies file {args.anomalies}: {exc}", file=sys.stderr)
            return 4

    # Normalize probability to percentage scale for display
    prob_val = float(args.probability)
    if prob_val <= 1.0:
        display_prob = prob_val * 100.0
    else:
        display_prob = prob_val

    # Configure Gemini unless we're explicitly in dry-run mode
    if not args.dry_run:
        try:
            configure_gemini()
        except Exception as exc:
            print(f"Failed to configure Gemini: {exc}", file=sys.stderr)
            return 5
    else:
        # Mark dry-run via env var so generate_explanation can detect it
        os.environ["GOOGLE_API_KEY"] = "DUMMY_KEY"

    prompt = build_prompt(
        provider_id=args.provider_id,
        prediction=args.prediction,
        probability=display_prob,
        top_features=top_features,
        shap_values=shap_values,
        claim_stats=claim_stats,
        anomalies=anomalies,
    )

    try:
        result = generate_explanation(prompt, max_output_tokens=args.max_tokens)
    except Exception as exc:
        print(f"Failed to generate explanation: {exc}", file=sys.stderr)
        return 6
    _print_report(args.provider_id, args.prediction, display_prob, result)

    output_path = args.output
    if not output_path:
        safe_id = args.provider_id.replace("/", "_")
        output_path = os.path.join("outputs", f"{safe_id}_report.json")

    try:
        prob_float = float(args.probability)
        if prob_float > 1.0:
            prob_float = prob_float / 100.0

        _write_json_report(output_path, args.provider_id, args.prediction, prob_float, result)
        logger.info("Wrote explainability JSON report to %s", output_path)
    except Exception as exc:
        print(f"Failed to write output file {output_path}: {exc}", file=sys.stderr)
        return 7
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
