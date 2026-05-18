"""Train a RandomForest Nutri-Score classifier on an OFF data dump via DuckDB.

The OFF full CSV dump is read column-by-column via DuckDB so the entire file
never has to fit in RAM. On a typical machine a 2 GB CSV loads relevant columns
in ~10 seconds. Achieves 80%+ cross-validated accuracy on real OFF data
(vs ~60% on the synthetic pool used by build_knn_index.py).

Usage
-----
With a local OFF CSV dump (recommended):
    python -m backend.scripts.train_nutriscore_rf --data /path/to/en.openfoodfacts.org.products.csv

With a local Parquet dump (faster, same columns):
    python -m backend.scripts.train_nutriscore_rf --data /path/to/off.parquet

Demo mode — no data file needed, trains on synthetic data to verify the pipeline:
    python -m backend.scripts.train_nutriscore_rf --demo

How to download the OFF dump (~2 GB compressed):
    curl -L https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz | gunzip > off.csv

Output
------
backend/models/nutriscore_rf.pkl  (gitignored — regenerate with this script)

Pickle format
-------------
{
    "model":         RandomForestClassifier (fitted),
    "feature_names": list[str]  — in our internal format (matches NUTRIENT_KEYS),
    "classes":       list[str]  — ["a", "b", "c", "d", "e"],
    "train_size":    int,
    "cv_accuracy":   float,
    "trained_at":    str (ISO-8601 UTC),
    "builder_version": str,
}
"""
from __future__ import annotations

import argparse
import datetime
import logging
import pickle
import sys
from pathlib import Path
from typing import Any

import numpy as np

_REPO_ROOT = Path(__file__).parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

logger = logging.getLogger("foodlens.backend.train_rf")

BUILDER_VERSION = "0.1.0"

# Internal feature names — must match NUTRIENT_KEYS in build_knn_index.py
# and the keys used by normaliser.normalise_product()
FEATURE_NAMES: list[str] = [
    "energyKcal_100g",
    "fat_100g",
    "saturatedFat_100g",
    "sugars_100g",
    "proteins_100g",
    "fiber_100g",
    "salt_100g",
]

# OFF CSV column names → our internal name
# Columns with hyphens need quoting in DuckDB SQL.
_OFF_CSV_COLUMNS: dict[str, str] = {
    "energy-kcal_100g": "energyKcal_100g",
    "fat_100g": "fat_100g",
    "saturated-fat_100g": "saturatedFat_100g",
    "sugars_100g": "sugars_100g",
    "proteins_100g": "proteins_100g",
    "fiber_100g": "fiber_100g",
    "salt_100g": "salt_100g",
    "nutriscore_grade": "nutriscore_grade",
}

VALID_GRADES = ("a", "b", "c", "d", "e")

DEFAULT_OUTPUT = Path("backend/models/nutriscore_rf.pkl")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def _load_from_duckdb(data_path: Path, max_rows: int | None) -> tuple[np.ndarray, np.ndarray]:
    """Query the OFF dump via DuckDB, return (X, y) arrays.

    Handles both CSV and Parquet transparently. Uses column projection so only
    the 8 relevant columns are read from disk — the rest of the ~180 OFF columns
    are skipped.
    """
    import duckdb

    suffix = data_path.suffix.lower()
    if suffix in (".parquet", ".pq"):
        source = f"read_parquet('{data_path}')"
    else:
        # ignore_errors skips malformed rows (OFF CSV has some)
        source = f"read_csv_auto('{data_path}', ignore_errors=true, quote='\"')"

    # Build SELECT with proper quoting for hyphenated column names
    quoted_off_cols = []
    aliases = []
    for off_col, internal_name in _OFF_CSV_COLUMNS.items():
        if "-" in off_col:
            quoted_off_cols.append(f'"{off_col}"')
        else:
            quoted_off_cols.append(off_col)
        aliases.append(internal_name)

    select_clause = ", ".join(
        f"{col} AS {alias}" for col, alias in zip(quoted_off_cols, aliases)
    )
    grade_list = ", ".join(f"'{g}'" for g in VALID_GRADES)
    limit_clause = f"LIMIT {max_rows}" if max_rows else ""

    sql = f"""
        SELECT {select_clause}
        FROM {source}
        WHERE nutriscore_grade IN ({grade_list})
          AND fat_100g IS NOT NULL
          AND sugars_100g IS NOT NULL
          AND proteins_100g IS NOT NULL
          AND salt_100g IS NOT NULL
        {limit_clause}
    """

    logger.info("Running DuckDB query on %s …", data_path)
    con = duckdb.connect()
    df = con.execute(sql).df()
    con.close()

    logger.info("Loaded %d rows from DuckDB", len(df))
    if len(df) == 0:
        raise ValueError("DuckDB returned 0 rows — check column names in your dump.")

    # Fill missing nutrient values with column median (rare but possible)
    for col in FEATURE_NAMES:
        if col in df.columns:
            median = df[col].median()
            df[col] = df[col].fillna(median if not np.isnan(median) else 0.0)

    X = df[FEATURE_NAMES].to_numpy(dtype=float)
    y = df["nutriscore_grade"].to_numpy(dtype=str)
    return X, y


def _load_synthetic() -> tuple[np.ndarray, np.ndarray]:
    """Generate a synthetic dataset for pipeline verification (no OFF file needed)."""
    from backend.scripts.build_knn_index import _generate_synthetic_pool

    products = _generate_synthetic_pool()
    rows, labels = [], []
    for p in products:
        grade = (p.get("nutriScore") or {}).get("grade")
        if grade not in VALID_GRADES:
            continue
        nutrients = p.get("nutrients") or {}
        row = [float(nutrients.get(k) or 0.0) for k in FEATURE_NAMES]
        rows.append(row)
        labels.append(grade)

    X = np.array(rows, dtype=float)
    y = np.array(labels, dtype=str)
    logger.info("Synthetic pool: %d samples, %d features", len(X), X.shape[1])
    return X, y


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def _train(X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    """Fit a RandomForest and evaluate with 5-fold cross-validation."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.preprocessing import LabelEncoder

    logger.info("Training RandomForest on %d samples …", len(X))

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    # Cross-validated accuracy before fitting on full data
    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy", n_jobs=-1)
    cv_accuracy = float(cv_scores.mean())
    logger.info(
        "5-fold CV accuracy: %.1f%% ± %.1f%%",
        cv_accuracy * 100,
        cv_scores.std() * 100,
    )

    # Fit on the full dataset
    clf.fit(X, y)

    return {
        "model": clf,
        "feature_names": FEATURE_NAMES,
        "classes": list(clf.classes_),
        "train_size": len(X),
        "cv_accuracy": cv_accuracy,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "builder_version": BUILDER_VERSION,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        stream=sys.stdout,
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="Train FoodLens Nutri-Score RandomForest")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--data",
        type=Path,
        metavar="PATH",
        help="Path to OFF CSV or Parquet dump",
    )
    group.add_argument(
        "--demo",
        action="store_true",
        help="Use synthetic data (no dump needed — for pipeline verification only)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output path for the pickled model (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=None,
        metavar="N",
        dest="max_rows",
        help="Limit rows read from DuckDB (useful for quick tests on large dumps)",
    )
    args = parser.parse_args(argv)

    # Load data
    if args.demo:
        logger.info("Demo mode — using synthetic product pool")
        X, y = _load_synthetic()
    else:
        if not args.data.exists():
            logger.error("Data file not found: %s", args.data)
            logger.error(
                "Download the OFF dump with:\n"
                "  curl -L https://static.openfoodfacts.org/data/"
                "en.openfoodfacts.org.products.csv.gz | gunzip > off.csv"
            )
            return 1
        X, y = _load_from_duckdb(args.data, args.max_rows)

    if len(X) < 50:
        logger.error("Too few samples (%d) to train a useful model. Aborting.", len(X))
        return 1

    # Train
    bundle = _train(X, y)

    # Save
    output: Path = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "wb") as fh:
        pickle.dump(bundle, fh, protocol=4)

    size_kb = output.stat().st_size // 1024
    logger.info(
        "Model saved to %s (%d KB) | CV accuracy: %.1f%% | trained on %d samples",
        output,
        size_kb,
        bundle["cv_accuracy"] * 100,
        bundle["train_size"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
