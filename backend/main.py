import logging
import sys
import os
from pathlib import Path

# Add project root to sys.path so we can import rag and explainability
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

logger = logging.getLogger(__name__)

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from dotenv import load_dotenv

import joblib
import pandas as pd

from services.explainability_service import ExplainabilityService
from services.report_generation_service import ReportGenerationService

# Import AI modules
load_dotenv()

# ---------------------------------------------------------------------------
# Gemini explainability module (always importable)
# ---------------------------------------------------------------------------
try:
    import explainability
    explainability.configure_gemini()
    EXPLAINABILITY_AVAILABLE = True
except Exception as e:
    print(f"Warning: Failed to import or configure explainability module: {e}")
    explainability = None
    EXPLAINABILITY_AVAILABLE = False

# ---------------------------------------------------------------------------
# RAG pipeline (optional; must not break /explain if unavailable)
# ---------------------------------------------------------------------------
try:
    from rag.rag.rag_pipeline import RAGPipeline
    rag_pipeline = RAGPipeline()
    RAG_AVAILABLE = True
except Exception as e:
    print(f"Warning: Failed to import RAG pipeline: {e}")
    rag_pipeline = None
    RAG_AVAILABLE = False


def rag_chat(message: str) -> str:
    """Wrapper around the RAG pipeline for the /chat endpoint."""
    if rag_pipeline is not None:
        return rag_pipeline.ask(message)
    raise RuntimeError("RAG pipeline is not available.")


app = FastAPI(title="Fraud Investigation Platform API")

# Load ML assets
try:
    MODEL_DIR = PROJECT_ROOT / "models"

    model = joblib.load(MODEL_DIR / "logistic_regression.pkl")
    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    feature_names = joblib.load(MODEL_DIR / "feature_names.pkl")

    print("✅ Logistic Regression loaded")
    print("✅ Scaler loaded")
    print("✅ Feature names loaded")

except Exception as e:
    print(f"❌ Model loading failed: {e}")
    model = None
    scaler = None
    feature_names = []

# Load background data for SHAP (scaled provider features)
background_data = None
try:
    provider_df = pd.read_csv(PROJECT_ROOT / "notebooks" / "provider_master.csv")
    if feature_names and scaler is not None:
        background_raw = provider_df[feature_names].fillna(0).values
        background_data = scaler.transform(background_raw)
        print(f"✅ Background data loaded: {background_data.shape[0]} samples")
except Exception as e:
    print(f"⚠️ Failed to load background data for SHAP: {e}")

# Initialize services
explainability_service = ExplainabilityService(
    model=model,
    scaler=scaler,
    feature_names=feature_names,
    background_data=background_data,
)
report_generation_service = ReportGenerationService()

# Initialize SHAP explainer once at startup (reused for every request)
shap_initialized = explainability_service.initialize_explainer()
if shap_initialized:
    print("✅ SHAP LinearExplainer initialized")
else:
    print("⚠️ SHAP explainer could not be initialized; fallback will be used")

# Import and attach auth routes
from backend.auth import router as auth_router
from backend.routes.investigation import router as investigation_router
app.include_router(auth_router)
app.include_router(investigation_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    provider_id: str
    features: Dict[str, Any]

class ChatRequest(BaseModel):
    provider_id: str
    message: str

@app.post("/predict")
def predict_fraud(request: PredictRequest):

    try:
        # Create dataframe in correct feature order
        input_data = []

        for feature in feature_names:
            input_data.append(request.features.get(feature, 0))

        X = pd.DataFrame([input_data], columns=feature_names)

        # Scale data
        X_scaled = scaler.transform(X)

        # Predict
        probability = model.predict_proba(X_scaled)[0][1]
        prediction = model.predict(X_scaled)[0]

        risk_level = (
            "High" if probability > 0.8
            else "Medium" if probability > 0.5
            else "Low"
        )

        return {
            "provider_id": request.provider_id,
            "fraud_score": round(float(probability * 100), 2),
            "prediction": int(prediction),
            "risk_level": risk_level,
            "features_used": request.features
        }

    except Exception as e:
        return {
            "error": str(e)
        }

@app.get("/explain/{provider_id}")
def explain_fraud(provider_id: str):
    try:
        provider_df = pd.read_csv(PROJECT_ROOT / "notebooks" / "provider_master.csv")

        row = provider_df[provider_df["Provider"] == provider_id]

        if row.empty:
            return {"error": "Provider not found"}

        row = row.iloc[0]

        feature_cols = feature_names

        X_input = pd.DataFrame([[row.get(col, 0) for col in feature_cols]],
                               columns=feature_cols)

        X_scaled = scaler.transform(X_input)

        probability = float(model.predict_proba(X_scaled)[0][1])
        prediction = int(model.predict(X_scaled)[0])

        risk_level = (
            "High" if probability > 0.8
            else "Medium" if probability > 0.5
            else "Low"
        )

        # ------------------------------------------------------------------
        # Real SHAP computation
        # ------------------------------------------------------------------
        shap_values = explainability_service.compute_shap_values(X_scaled)
        fallback_used = False
        shap_error = None

        if shap_values is not None:
            # Rank features by absolute SHAP value (descending)
            feature_contributions = explainability_service.rank_features(
                feature_names=feature_cols,
                shap_values=shap_values,
                feature_values=[float(X_input.iloc[0][col]) for col in feature_cols],
                baseline_values=[0.0] * len(feature_cols),
            )
        else:
            # Fallback: use scaled-value heuristic if SHAP fails
            fallback_used = True
            shap_error = "SHAP computation failed; using fallback feature importance."
            logger.warning("SHAP computation failed for %s; using fallback.", provider_id)
            feature_contributions = []
            for i, col in enumerate(feature_cols):
                raw_value = float(X_input.iloc[0][col])
                scaled_value = float(X_scaled[0][i])
                feature_contributions.append({
                    "feature_name": col,
                    "shap_value": round(abs(scaled_value) * 0.1, 3),
                    "feature_value": raw_value,
                    "baseline_value": 0.0,
                })

        top_features = [f["feature_name"] for f in feature_contributions]

        # ------------------------------------------------------------------
        # Gemini explainability (optional; fallback if unavailable)
        # ------------------------------------------------------------------
        explanation_fallback = False
        explanation_error = None
        report_text = ""

        if EXPLAINABILITY_AVAILABLE and explainability is not None:
            try:
                prompt = explainability.build_prompt(
                    provider_id=provider_id,
                    prediction=risk_level,
                    probability=round(probability, 2),
                    top_features=top_features,
                    shap_values={f["feature_name"]: f["shap_value"] for f in feature_contributions}
                )
                report_text = explainability.generate_explanation(
                    prompt,
                    max_output_tokens=800
                )
            except Exception as exc:
                explanation_fallback = True
                explanation_error = str(exc)
                report_text = (
                    "The Explainability service is temporarily unavailable. "
                    "A grounded report was generated from the available structured inputs."
                )
                logger.warning("Explainability generation failed for %s: %s", provider_id, exc)
        else:
            explanation_fallback = True
            explanation_error = "Explainability module is not available."
            report_text = (
                "The Explainability service is temporarily unavailable. "
                "A grounded report was generated from the available structured inputs."
            )

        # ------------------------------------------------------------------
        # Build structured explanation payload
        # ------------------------------------------------------------------
        structured_payload = explainability_service.build_explanation_payload(
            provider_id=provider_id,
            prediction=risk_level,
            probability=probability,
            feature_contributions=feature_contributions,
            explanation_text=report_text,
        )

        # ------------------------------------------------------------------
        # Generate SHAP plots (summary + waterfall) as base64
        # ------------------------------------------------------------------
        plots_payload = explainability_service.build_plot_payload(
            explanation_payload=structured_payload,
            shap_values=shap_values,
            X_scaled=X_scaled,
            feature_names=feature_cols,
        )

        # ------------------------------------------------------------------
        # Report generation (unchanged contract)
        # ------------------------------------------------------------------
        report_context = {
            "provider_id": provider_id,
            "fraud_prediction": {
                "label": risk_level,
                "prediction": prediction,
                "probability": round(probability, 4),
            },
            "investigation_findings": [
                {"source": "provider", "summary": "Provider-level risk factors were evaluated."},
                {"source": "claim", "summary": "Claim-level signals were reviewed."},
            ],
            "fraud_hypotheses": [
                {"hypothesis": "Billing anomaly pattern", "confidence": round(probability, 4)},
            ],
            "shap_explanations": structured_payload["structured_explanation"]["features"],
            "confidence_scores": {
                "probability": round(probability, 4),
                "model_confidence": risk_level,
            },
        }
        generated_report = report_generation_service.generate_report(report_context)

        return {
            "provider_id": provider_id,
            "fraud_score": round(probability * 100, 2),
            "prediction": prediction,
            "risk_level": risk_level,
            "top_features": top_features,
            "shap_summary": report_text,
            "feature_importance": feature_contributions,
            "structured_explanation": structured_payload["structured_explanation"],
            "plots": plots_payload,
            "report_generation": {
                "markdown_report": generated_report["markdown_report"],
                "structured_report": generated_report["structured_report"],
                "fallback_used": explanation_fallback,
                "explanation_error": explanation_error,
            },
            "explanation_generation": {
                "fallback_used": explanation_fallback or fallback_used,
                "error": explanation_error or shap_error,
                "report_text": report_text,
            },
        }

    except Exception as e:
        logger.exception("Explain endpoint failed for %s", provider_id)
        return {"error": str(e)}

@app.post("/chat")
def chatbot_interaction(request: ChatRequest):
    try:
        # Run real RAG pipeline
        response_text = rag_chat(request.message)
    except Exception as e:
        response_text = f"Failed to connect to RAG pipeline: {e}"
        
    return {
        "response": response_text
    }

@app.get("/")
def read_root():
    return {"message": "Fraud Investigation API is running"}

@app.get("/test-key")
def test_key():
    import os
    return {
        "gemini_key": os.getenv("GEMINI_API_KEY")
    }