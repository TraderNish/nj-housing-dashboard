"""
Build cleaned NJ ZHVI data for the dashboard.

Reads the Zillow ZHVI zip-level CSV, filters to NJ, computes 6 percent-change
columns anchored on the latest month, and emits:
  - data.json : the cleaned dataset (deliverable)
  - data.js   : same payload as `window.__HOUSING__` so the dashboard loads
                from file:// with no server / CORS hassle.

Change columns use a positional month offset against the FULL monthly series
(ZHVI is continuous monthly), so the 5-year (60-month) lookback is exact even
though only the last 60 months are kept for display. If a lookback month is
missing or NaN, that change is left null rather than faked.
"""

import json
import re

import numpy as np
import pandas as pd

CSV = "zhvi_zip.csv"
DISPLAY_MONTHS = 60
# label -> months of lookback from the latest month
HORIZONS = {"m1": 1, "m3": 3, "m6": 6, "y1": 12, "y3": 36, "y5": 60}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def main() -> None:
    df = pd.read_csv(CSV, dtype={"RegionName": str})
    df = df[df["State"] == "NJ"].copy()

    date_cols = [c for c in df.columns if DATE_RE.match(c)]
    date_cols.sort()  # chronological
    latest = date_cols[-1]
    display_cols = date_cols[-DISPLAY_MONTHS:]

    records = []
    for _, row in df.iterrows():
        latest_val = row[latest]
        if pd.isna(latest_val):
            continue  # no current price -> not useful in the dashboard

        changes = {}
        for label, back in HORIZONS.items():
            past_col = date_cols[-1 - back]  # positional offset on full series
            past_val = row[past_col]
            if pd.isna(past_val) or past_val == 0:
                changes[label] = None
            else:
                pct = (latest_val - past_val) / past_val * 100.0
                changes[label] = round(float(pct), 1)

        months = {c: (None if pd.isna(row[c]) else round(float(row[c])))
                  for c in display_cols}

        records.append({
            "zip": row["RegionName"],
            "city": None if pd.isna(row["City"]) else row["City"],
            "county": None if pd.isna(row["CountyName"]) else row["CountyName"],
            "latest": round(float(latest_val)),
            "changes": changes,
            "months": months,
        })

    payload = {
        "latestMonth": latest,
        "monthCols": display_cols,
        "horizons": HORIZONS,
        "count": len(records),
        "rows": records,
    }

    with open("data.json", "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    with open("data.js", "w") as f:
        f.write("window.__HOUSING__ = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";")

    counties = sorted({r["county"] for r in records if r["county"]})
    print(f"NJ zips written: {len(records)}")
    print(f"latest month   : {latest}")
    print(f"display months : {display_cols[0]} .. {display_cols[-1]} "
          f"({len(display_cols)} cols)")
    print(f"counties       : {len(counties)}")


if __name__ == "__main__":
    main()
