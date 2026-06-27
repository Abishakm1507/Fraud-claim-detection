from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from agents.beneficiary_analysis_agent import BeneficiaryAnalysisAgent
from agents.claim_analysis_agent import ClaimAnalysisAgent
from agents.coordinator_agent import InvestigationCoordinatorAgent
from agents.provider_analysis_agent import ProviderAnalysisAgent
from ml_engine.preprocessing import (
    clean_beneficiary_data,
    clean_inpatient_data,
    clean_outpatient_data,
    merge_beneficiary,
    merge_claims,
)
from tasks.investigation_tasks import InvestigationTaskFactory
from utils.investigation_utils import (
    build_reference_stats,
    resolve_row_reference_stats,
    save_combined_reports,
    save_provider_report,
)

logger = logging.getLogger(__name__)

REFERENCE_COLUMNS = [
    "TotalReimbursed",
    "AvgReimbursed",
    "MaxReimbursed",
    "TotalClaims",
    "InpatientRatio",
    "OutpatientRatio",
    "PatientsPerClaim",
    "PhysiciansPerClaim",
    "SameAttendOperRate",
    "DeceasedPatientRate",
    "AvgClaimDuration",
    "MaxClaimDuration",
    "AvgDaysInHospital",
    "TotalDaysInHospital",
    "AvgDeductible",
    "TotalDeductible",
    "UniquePatients",
    "AvgPatientAge",
    "AvgChronicConds",
    "DuplicateClaimsRatio",
    "TopDiagnosisCodeRatio",
    "TopProcedureCodeRatio",
    "MaxClaimsSingleDay",
    "ClaimGrowth",
    "RepeatVisitsRatio",
    "BeneficiaryConcentration",
    "ProviderDependency",
    "ChronicPatientRatio",
    "SharedDiagnosisRatio",
]


class FraudInvestigationCrew:
    """Runs an investigation workflow over provider fraud predictions."""

    def __init__(
        self,
        output_dir: str | None = None,
        claims_df: pd.DataFrame | None = None,
    ) -> None:
        self.output_dir = Path(output_dir or "outputs")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.provider_agent = ProviderAnalysisAgent()
        self.claim_agent = ClaimAnalysisAgent()
        self.beneficiary_agent = BeneficiaryAnalysisAgent()
        self.coordinator_agent = InvestigationCoordinatorAgent()
        self.claims_df = claims_df

    def _find_data_file(self, search_dirs: list[Path], patterns: list[str]) -> Path | None:
        """Locate the first matching claims dataset file across search directories."""
        for directory in search_dirs:
            if not directory.exists():
                continue
            for pattern in patterns:
                matches = sorted(directory.glob(pattern))
                if matches:
                    return matches[0]
        return None

    def _load_claims_data(self) -> None:
        """Load and clean claim-level data for provider enrichment."""
        if self.claims_df is not None:
            return

        project_root = Path.cwd()
        search_dirs = [project_root / "data", project_root]

        inpatient_patterns = [
            "Train_Inpatientdata-*.csv",
            "Test_Inpatientdata-*.csv",
            "*Inpatientdata*.csv",
        ]
        outpatient_patterns = [
            "Train_Outpatientdata-*.csv",
            "Test_Outpatientdata-*.csv",
            "*Outpatientdata*.csv",
        ]
        beneficiary_patterns = [
            "Train_Beneficiarydata-*.csv",
            "Test_Beneficiarydata-*.csv",
            "*Beneficiarydata*.csv",
        ]

        inpatient_frames: list[pd.DataFrame] = []
        outpatient_frames: list[pd.DataFrame] = []
        beneficiary_frames: list[pd.DataFrame] = []
        loaded_paths: set[Path] = set()

        def append_unique_frame(frames: list[pd.DataFrame], path: Path) -> None:
            resolved = path.resolve()
            if resolved in loaded_paths:
                return
            loaded_paths.add(resolved)
            frames.append(pd.read_csv(path))
            logger.info("Loaded claims dataset from %s", path)

        for pattern in inpatient_patterns:
            path = self._find_data_file(search_dirs, [pattern])
            if path is not None:
                append_unique_frame(inpatient_frames, path)

        for pattern in outpatient_patterns:
            path = self._find_data_file(search_dirs, [pattern])
            if path is not None:
                append_unique_frame(outpatient_frames, path)

        for pattern in beneficiary_patterns:
            path = self._find_data_file(search_dirs, [pattern])
            if path is not None:
                append_unique_frame(beneficiary_frames, path)

        if not inpatient_frames and not outpatient_frames:
            logger.warning(
                "No claim-level CSV files found; skipping claim enrichment. "
                "Pass claims_df to FraudInvestigationCrew to enable full analysis."
            )
            return

        inpatient_all = (
            pd.concat(inpatient_frames, ignore_index=True)
            if inpatient_frames
            else pd.DataFrame()
        )
        outpatient_all = (
            pd.concat(outpatient_frames, ignore_index=True)
            if outpatient_frames
            else pd.DataFrame()
        )

        inpatient_cleaned = (
            clean_inpatient_data(inpatient_all) if not inpatient_all.empty else inpatient_all
        )
        outpatient_cleaned = (
            clean_outpatient_data(outpatient_all) if not outpatient_all.empty else outpatient_all
        )

        if inpatient_cleaned.empty and outpatient_cleaned.empty:
            logger.warning("Claim datasets were empty after cleaning; skipping enrichment.")
            return

        claims_all = merge_claims(inpatient_cleaned, outpatient_cleaned)

        if beneficiary_frames:
            beneficiary_all = pd.concat(beneficiary_frames, ignore_index=True).drop_duplicates(
                subset=["BeneID"]
            )
            beneficiary_cleaned = clean_beneficiary_data(
                beneficiary_all,
                inpatient_all if not inpatient_all.empty else inpatient_cleaned,
                outpatient_all if not outpatient_all.empty else outpatient_cleaned,
            )
            self.claims_df = merge_beneficiary(claims_all, beneficiary_cleaned)
        else:
            self.claims_df = claims_all

        logger.info("Prepared claims dataframe with shape %s", self.claims_df.shape)

    def _compute_top_code_ratio(
        self,
        code_column: str,
        ratio_column: str,
    ) -> pd.Series:
        """Compute the share of claims using each provider's most frequent code."""
        if self.claims_df is None or self.claims_df.empty:
            return pd.Series(dtype=float)

        valid_claims = self.claims_df[self.claims_df[code_column] != "NONE"]
        code_counts = (
            valid_claims.groupby(["Provider", code_column]).size().reset_index(name="code_count")
        )
        code_counts["rank"] = code_counts.groupby("Provider")["code_count"].rank(
            ascending=False,
            method="first",
        )
        top_codes = code_counts[code_counts["rank"] == 1]
        provider_totals = valid_claims.groupby("Provider").size().rename("total_claims")
        top_counts = top_codes.set_index("Provider")["code_count"]
        ratios = (top_counts / provider_totals).rename(ratio_column)
        return ratios

    def _enrich_provider_df(self, provider_df: pd.DataFrame) -> pd.DataFrame:
        """Enrich provider features with claim-level and beneficiary metrics."""
        self._load_claims_data()
        df_enriched = provider_df.copy()

        if self.claims_df is None or self.claims_df.empty:
            logger.warning("Claims data unavailable; returning provider_df without enrichment.")
            if "OutpatientRatio" not in df_enriched.columns and "InpatientRatio" in df_enriched.columns:
                df_enriched["OutpatientRatio"] = 1.0 - df_enriched["InpatientRatio"]
            if "RepeatVisitsRatio" not in df_enriched.columns:
                df_enriched["RepeatVisitsRatio"] = (
                    df_enriched["TotalClaims"] / df_enriched["UniquePatients"].clip(lower=1)
                )
            return df_enriched

        dup_cols = ["BeneID", "ClaimStartDt", "InscClaimAmtReimbursed"]
        self.claims_df["IsDuplicateClaim"] = (
            self.claims_df.duplicated(subset=dup_cols, keep=False).astype(int)
        )
        dup_counts = self.claims_df.groupby("Provider")["IsDuplicateClaim"].sum().rename(
            "DuplicateClaimsCount"
        )

        day_counts = self.claims_df.groupby(["Provider", "ClaimStartDt"]).size()
        max_claims_single_day = day_counts.groupby("Provider").max().rename("MaxClaimsSingleDay")

        pb_counts = self.claims_df.groupby(["Provider", "BeneID"]).size().reset_index(name="count")
        pb_counts["bene_rank"] = pb_counts.groupby("Provider")["count"].rank(
            ascending=False,
            method="first",
        )
        unique_patients_count = pb_counts.groupby("Provider")["BeneID"].count().rename(
            "UniquePatients_count"
        )
        pb_counts = pb_counts.merge(unique_patients_count, on="Provider")
        pb_counts["is_top_5pct"] = pb_counts["bene_rank"] <= (
            pb_counts["UniquePatients_count"] * 0.05
        ).clip(lower=1)
        top_5pct_claims = pb_counts[pb_counts["is_top_5pct"]].groupby("Provider")["count"].sum().rename(
            "Top5PctClaimsCount"
        )

        total_claims_per_bene = self.claims_df.groupby("BeneID").size().rename("TotalBeneClaims")
        pb_counts = pb_counts.merge(total_claims_per_bene, on="BeneID", how="left")
        pb_counts["dependency_ratio"] = pb_counts["count"] / pb_counts["TotalBeneClaims"].clip(lower=1)
        provider_dependency = pb_counts.groupby("Provider")["dependency_ratio"].mean().rename(
            "ProviderDependency"
        )

        if "ChronicCondCount" in self.claims_df.columns:
            bene_chronic = (
                self.claims_df.groupby(["Provider", "BeneID"])["ChronicCondCount"].max().reset_index()
            )
            bene_chronic["is_chronic_3plus"] = (bene_chronic["ChronicCondCount"] >= 3).astype(int)
            chronic_patient_ratio = bene_chronic.groupby("Provider")["is_chronic_3plus"].mean().rename(
                "ChronicPatientRatio"
            )
        else:
            chronic_patient_ratio = pd.Series(dtype=float, name="ChronicPatientRatio")

        p_diag_counts = (
            self.claims_df[self.claims_df["ClmDiagnosisCode_1"] != "NONE"]
            .groupby(["Provider", "ClmDiagnosisCode_1"])
            .size()
            .reset_index(name="diag_count")
        )
        p_diag_counts["rank"] = p_diag_counts.groupby("Provider")["diag_count"].rank(
            ascending=False,
            method="first",
        )
        top_diags = p_diag_counts[p_diag_counts["rank"] == 1]
        claims_top_diag = self.claims_df.merge(
            top_diags[["Provider", "ClmDiagnosisCode_1"]],
            on=["Provider", "ClmDiagnosisCode_1"],
            how="inner",
        )
        patients_with_top_diag = claims_top_diag.groupby("Provider")["BeneID"].nunique().rename(
            "PatientsWithTopDiag"
        )

        provider_dates = self.claims_df.groupby("Provider")["ClaimStartDt"].agg(["min", "max"])
        provider_dates["mid"] = provider_dates["min"] + (provider_dates["max"] - provider_dates["min"]) / 2
        claims_dates = self.claims_df.merge(provider_dates, on="Provider")
        claims_dates["is_second_half"] = claims_dates["ClaimStartDt"] > claims_dates["mid"]
        half_counts = claims_dates.groupby(["Provider", "is_second_half"]).size().unstack(fill_value=0)
        first_half_cnt = half_counts[False] if False in half_counts.columns else pd.Series(
            0, index=half_counts.index
        )
        second_half_cnt = half_counts[True] if True in half_counts.columns else pd.Series(
            0, index=half_counts.index
        )
        claim_growth = ((second_half_cnt - first_half_cnt) / first_half_cnt.clip(lower=1)).rename(
            "ClaimGrowth"
        )

        top_diagnosis_ratio = self._compute_top_code_ratio(
            "ClmDiagnosisCode_1",
            "TopDiagnosisCodeRatio",
        )
        top_procedure_ratio = self._compute_top_code_ratio(
            "ClmProcedureCode_1",
            "TopProcedureCodeRatio",
        )

        for feature_series in [
            dup_counts,
            max_claims_single_day,
            top_5pct_claims,
            provider_dependency,
            chronic_patient_ratio,
            patients_with_top_diag,
            claim_growth,
            top_diagnosis_ratio,
            top_procedure_ratio,
        ]:
            if feature_series.empty:
                continue
            df_enriched = df_enriched.merge(
                feature_series.reset_index(),
                on="Provider",
                how="left",
            )

        df_enriched = df_enriched.fillna(0.0)
        df_enriched["DuplicateClaimsRatio"] = df_enriched.get(
            "DuplicateClaimsCount", 0.0
        ) / df_enriched["TotalClaims"].clip(lower=1)
        df_enriched["BeneficiaryConcentration"] = df_enriched.get(
            "Top5PctClaimsCount", 0.0
        ) / df_enriched["TotalClaims"].clip(lower=1)
        df_enriched["SharedDiagnosisRatio"] = df_enriched.get(
            "PatientsWithTopDiag", 0.0
        ) / df_enriched["UniquePatients"].clip(lower=1)
        df_enriched["OutpatientRatio"] = 1.0 - df_enriched["InpatientRatio"]
        df_enriched["RepeatVisitsRatio"] = (
            df_enriched["TotalClaims"] / df_enriched["UniquePatients"].clip(lower=1)
        )

        return df_enriched

    def _build_provider_row(self, provider_record: dict[str, Any]) -> dict[str, Any]:
        """Remove label columns from a provider record before analysis."""
        return {key: value for key, value in provider_record.items() if key != "FraudLabel"}

    def investigate(
        self,
        provider_df: pd.DataFrame,
        fraud_probabilities: pd.DataFrame,
        threshold: float = 0.6,
        claims_df: pd.DataFrame | None = None,
    ) -> list[dict[str, Any]]:
        """
        Run the multi-agent investigation pipeline for flagged providers.

        Uses deterministic specialist agents for scoring and writes JSON reports.
        """
        if claims_df is not None:
            self.claims_df = claims_df

        provider_df = provider_df.copy()
        fraud_probabilities = fraud_probabilities.copy()

        if "Provider" not in provider_df.columns:
            raise ValueError("provider_df must include a Provider column")
        if "Provider" not in fraud_probabilities.columns:
            raise ValueError("fraud_probabilities must include a Provider column")

        provider_df["Provider"] = provider_df["Provider"].astype(str)
        fraud_probabilities["Provider"] = fraud_probabilities["Provider"].astype(str)

        provider_df = self._enrich_provider_df(provider_df)
        provider_df = provider_df.merge(fraud_probabilities, on="Provider", how="left")
        reference_stats = build_reference_stats(provider_df, REFERENCE_COLUMNS)

        reports: list[dict[str, Any]] = []
        for _, row in provider_df.iterrows():
            provider_id = str(row.get("Provider"))
            fraud_probability = float(row.get("fraud_probability", 0.0) or 0.0)
            if fraud_probability < threshold:
                continue

            provider_row = self._build_provider_row(row.to_dict())
            row_reference_stats = resolve_row_reference_stats(provider_row, reference_stats)

            provider_findings = self.provider_agent.analyze(provider_row, row_reference_stats)
            claim_findings = self.claim_agent.analyze(provider_row, row_reference_stats)
            beneficiary_findings = self.beneficiary_agent.analyze(provider_row, row_reference_stats)
            coordinator_findings = self.coordinator_agent.analyze(
                provider_row,
                [provider_findings, claim_findings, beneficiary_findings],
                fraud_probability,
            )

            report = {
                "Provider": provider_id,
                "fraud_probability": round(fraud_probability, 4),
                "investigation_summary": {
                    "provider": provider_findings,
                    "claim": claim_findings,
                    "beneficiary": beneficiary_findings,
                    "coordinator": coordinator_findings,
                },
                "tasks": [
                    "provider_analysis",
                    "claim_analysis",
                    "beneficiary_analysis",
                    "coordinator",
                ],
            }
            reports.append(report)
            save_provider_report(report, self.output_dir)
            logger.info("Saved investigation report for provider %s", provider_id)

        save_combined_reports(reports, self.output_dir)
        logger.info("Investigation complete: %s provider(s) above threshold %.2f", len(reports), threshold)
        return reports

    def run_crew(
        self,
        provider_row: dict[str, Any],
        reference_stats: dict[str, dict[str, float]],
        fraud_probability: float,
    ) -> str:
        """Execute a CrewAI sequential workflow for a single provider (requires LLM API key)."""
        from crewai import Crew, Process

        row_reference_stats = resolve_row_reference_stats(provider_row, reference_stats)

        provider_task = InvestigationTaskFactory.create_provider_task(
            provider_row,
            row_reference_stats,
            self.provider_agent.agent,
        )
        claim_task = InvestigationTaskFactory.create_claim_task(
            provider_row,
            row_reference_stats,
            self.claim_agent.agent,
            context=[provider_task],
        )
        beneficiary_task = InvestigationTaskFactory.create_beneficiary_task(
            provider_row,
            row_reference_stats,
            self.beneficiary_agent.agent,
            context=[provider_task, claim_task],
        )
        coordinator_task = InvestigationTaskFactory.create_coordinator_task(
            provider_row,
            [provider_task, claim_task, beneficiary_task],
            fraud_probability,
            self.coordinator_agent.agent,
        )

        crew = Crew(
            agents=[
                self.provider_agent.agent,
                self.claim_agent.agent,
                self.beneficiary_agent.agent,
                self.coordinator_agent.agent,
            ],
            tasks=[provider_task, claim_task, beneficiary_task, coordinator_task],
            process=Process.sequential,
            verbose=True,
        )

        return str(crew.kickoff())
