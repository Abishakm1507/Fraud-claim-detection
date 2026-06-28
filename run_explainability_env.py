"""Run explainability using credentials from a .env file for provider PRV10091.

This helper loads environment variables from a `.env` file (if present)
using `python-dotenv`, validates that `GOOGLE_API_KEY` is set, and then
invokes `explainability.main()` with `--provider-id PRV10091`.

Usage:
1. Install dependency: `pip install python-dotenv`
2. Create a `.env` file in the project root with `GOOGLE_API_KEY=your_key_here`
3. Run: `python run_explainability_env.py`

Security: Do NOT commit your real `.env` to source control. Use `.env.example`
as a template and keep secrets out of git.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List

from dotenv import load_dotenv


def main(argv: List[str] | None = None) -> int:
    """Load .env and run the explainability tool for a given provider."""
    if argv is None:
        argv = sys.argv[1:]

    # Load .env from current working directory (project root)
    load_dotenv(override=True)

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment or .env file.", file=sys.stderr)
        print("Create a .env file with: GOOGLE_API_KEY=your_key_here", file=sys.stderr)
        return 2

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--provider-id", default="PRV10091")
    known_args, extra_args = parser.parse_known_args(argv)
    provider_id = known_args.provider_id
    output_path = os.path.join("outputs", f"{provider_id}_report.json")

    # Build default args for explainability
    default_args = [
        "--provider-id",
        provider_id,
        "--prediction",
        "Fraud",
        "--probability",
        "0.948",
        "--top-features",
        "num_inpatient_claims,total_reimbursement,duplicate_claims",
        "--max-tokens",
        "800",
        "--output",
        output_path,
    ]

    # Allow caller to append extra args and override defaults
    final_args = default_args + extra_args

    # Import and call the explainability main function
    try:
        from explainability import main as explain_main
    except Exception as exc:
        print(f"Failed to import explainability module: {exc}", file=sys.stderr)
        return 3

    return explain_main(final_args)


if __name__ == "__main__":
    raise SystemExit(main())
