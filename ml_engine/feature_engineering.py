import pandas as pd


def extract_top_codes(claims_bene, top_n=100):
    top100_diag = (
        claims_bene["ClmDiagnosisCode_1"]
        .value_counts()
        .drop("NONE", errors="ignore")
        .head(top_n)
        .index.tolist()
    )

    top100_proc = (
        claims_bene["ClmProcedureCode_1"]
        .value_counts()
        .drop("NONE", errors="ignore")
        .head(top_n)
        .index.tolist()
    )

    return top100_diag, top100_proc


def create_code_indicators(claims_bene, top100_diag, top100_proc):
    for code in top100_diag:
        claims_bene[f"Diag_{code}"] = (claims_bene["ClmDiagnosisCode_1"] == code).astype(int)

    for code in top100_proc:
        claims_bene[f"Proc_{code}"] = (claims_bene["ClmProcedureCode_1"] == code).astype(int)

    return claims_bene


def aggregate_provider_features(claims_bene, top100_diag, top100_proc):
    diag_cols_feat = [f"Diag_{c}" for c in top100_diag]
    proc_cols_feat = [f"Proc_{c}" for c in top100_proc]

    available_columns = set(claims_bene.columns)
    agg_dict = {
        "ClaimID": "count",
        "InscClaimAmtReimbursed": ["sum", "mean", "max"],
        "DeductibleAmtPaid": ["sum", "mean"],
    }
    if "ReimbRatio" in available_columns:
        agg_dict["ReimbRatio"] = "mean"
    if "ClaimDuration" in available_columns:
        agg_dict["ClaimDuration"] = ["mean", "max"]
    if "DaysInHospital" in available_columns:
        agg_dict["DaysInHospital"] = ["mean", "sum"]
    if "Age" in available_columns:
        agg_dict["Age"] = "mean"
    if "ChronicCondCount" in available_columns:
        agg_dict["ChronicCondCount"] = "mean"
    if "SameAttendOper" in available_columns:
        agg_dict["SameAttendOper"] = "sum"
    if "IsDead" in available_columns:
        agg_dict["IsDead"] = "sum"
    if "ClaimType" in available_columns:
        agg_dict["ClaimType"] = lambda x: (x == "Inpatient").sum()

    provider_df = claims_bene.groupby("Provider").agg(agg_dict)
    provider_df.columns = [
        "_".join(filter(None, col)).strip("_")
        if isinstance(col, tuple) else col
        for col in provider_df.columns
    ]
    provider_df = provider_df.reset_index()

    rename_columns = {
        "ClaimID_count": "TotalClaims",
        "InscClaimAmtReimbursed_sum": "TotalReimbursed",
        "InscClaimAmtReimbursed_mean": "AvgReimbursed",
        "InscClaimAmtReimbursed_max": "MaxReimbursed",
        "DeductibleAmtPaid_sum": "TotalDeductible",
        "DeductibleAmtPaid_mean": "AvgDeductible",
    }
    if "ReimbRatio_mean" in provider_df.columns:
        rename_columns["ReimbRatio_mean"] = "AvgReimbRatio"
    if "ClaimDuration_mean" in provider_df.columns:
        rename_columns["ClaimDuration_mean"] = "AvgClaimDuration"
    if "ClaimDuration_max" in provider_df.columns:
        rename_columns["ClaimDuration_max"] = "MaxClaimDuration"
    if "DaysInHospital_mean" in provider_df.columns:
        rename_columns["DaysInHospital_mean"] = "AvgDaysInHospital"
    if "DaysInHospital_sum" in provider_df.columns:
        rename_columns["DaysInHospital_sum"] = "TotalDaysInHospital"
    if "Age_mean" in provider_df.columns:
        rename_columns["Age_mean"] = "AvgPatientAge"
    if "ChronicCondCount_mean" in provider_df.columns:
        rename_columns["ChronicCondCount_mean"] = "AvgChronicConds"
    if "SameAttendOper_sum" in provider_df.columns:
        rename_columns["SameAttendOper_sum"] = "SameAttendOperCount"
    if "IsDead_sum" in provider_df.columns:
        rename_columns["IsDead_sum"] = "DeceasedPatientCount"
    if "ClaimType_<lambda>" in provider_df.columns:
        rename_columns["ClaimType_<lambda>"] = "InpatientClaimCount"

    provider_df = provider_df.rename(columns=rename_columns)

    uniq = claims_bene.groupby("Provider").agg(
        UniquePatients=("BeneID", "nunique"),
        UniqueAttendPhys=("AttendingPhysician", "nunique"),
        UniqueOperPhys=("OperatingPhysician", "nunique"),
        UniqueDiagnoses=("ClmDiagnosisCode_1", "nunique"),
        UniqueProcedures=("ClmProcedureCode_1", "nunique"),
    ).reset_index()

    provider_df = provider_df.merge(uniq, on="Provider", how="left")

    if "InpatientClaimCount" in provider_df.columns:
        provider_df["OutpatientClaimCount"] = (
            provider_df["TotalClaims"] - provider_df["InpatientClaimCount"]
        )
        provider_df["InpatientRatio"] = (
            provider_df["InpatientClaimCount"] / provider_df["TotalClaims"]
        )
    if "UniquePatients" in provider_df.columns:
        provider_df["PatientsPerClaim"] = (
            provider_df["UniquePatients"] / provider_df["TotalClaims"]
        )
    if "UniqueAttendPhys" in provider_df.columns:
        provider_df["PhysiciansPerClaim"] = (
            provider_df["UniqueAttendPhys"] / provider_df["TotalClaims"]
        )
    if "SameAttendOperCount" in provider_df.columns:
        provider_df["SameAttendOperRate"] = (
            provider_df["SameAttendOperCount"] / provider_df["TotalClaims"]
        )
    if "DeceasedPatientCount" in provider_df.columns and "UniquePatients" in provider_df.columns:
        provider_df["DeceasedPatientRate"] = (
            provider_df["DeceasedPatientCount"] / provider_df["UniquePatients"]
        )

    code_agg = claims_bene.groupby("Provider")[diag_cols_feat + proc_cols_feat].max()
    provider_df = provider_df.merge(code_agg.reset_index(), on="Provider", how="left")

    return provider_df


def add_labels(provider_df, labels_df):
    labels_df["FraudLabel"] = (labels_df["PotentialFraud"] == "Yes").astype(int)
    final_df = labels_df.merge(provider_df, on="Provider", how="left")
    return final_df


def create_claim_features(claims_bene):
    claims_bene["ReimbRatio"] = (
        claims_bene["InscClaimAmtReimbursed"] /
        (claims_bene["DeductibleAmtPaid"] + 1)
    )
    return claims_bene


def prepare_training_data(final_df, feature_columns, label_column="FraudLabel"):
    X = final_df[feature_columns]
    y = final_df[label_column]
    return X, y


def save_provider_master(provider_df, filepath):
    provider_df.to_csv(filepath, index=False)
