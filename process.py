"""
Build cleaned US ZHVI data for the dashboard (all states).

Reads the Zillow ZHVI zip-level CSV, computes 6 percent-change columns anchored
on the latest month for every zip in every state, and emits:
  - data.json : the cleaned dataset (deliverable)
  - data.js   : same payload as `window.__HOUSING__` (via JSON.parse for fast
                load) so the dashboard works from file:// with no server / CORS.

Change columns use a positional month offset against the FULL monthly series
(ZHVI is continuous monthly), so the 5-year (60-month) lookback is exact even
though only the last 60 months are kept for display. If a lookback month is
missing or NaN, that change is left null rather than faked.

Months are stored per-row as a flat array aligned to the top-level `monthCols`
order (not a date-keyed object) to keep the all-US payload compact.
"""

import json
import re

import pandas as pd

CSV = "zhvi_zip.csv"
DISPLAY_MONTHS = 60
# label -> months of lookback from the latest month
HORIZONS = {"m1": 1, "m3": 3, "m6": 6, "y1": 12, "y3": 36, "y5": 60}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def main() -> None:
    df = pd.read_csv(CSV, dtype={"RegionName": str})

    date_cols = [c for c in df.columns if DATE_RE.match(c)]
    date_cols.sort()  # chronological
    latest = date_cols[-1]
    display_cols = date_cols[-DISPLAY_MONTHS:]
    lookback_cols = {label: date_cols[-1 - back] for label, back in HORIZONS.items()}

    records = []
    for _, row in df.iterrows():
        latest_val = row[latest]
        if pd.isna(latest_val):
            continue  # no current price -> not useful in the dashboard

        changes = {}
        for label in HORIZONS:
            past_val = row[lookback_cols[label]]
            if pd.isna(past_val) or past_val == 0:
                changes[label] = None
            else:
                changes[label] = round(
                    float((latest_val - past_val) / past_val * 100.0), 1)

        months = [None if pd.isna(row[c]) else round(float(row[c]))
                  for c in display_cols]

        records.append({
            "zip": row["RegionName"],
            "state": None if pd.isna(row["State"]) else row["State"],
            "city": None if pd.isna(row["City"]) else row["City"],
            "county": None if pd.isna(row["CountyName"]) else row["CountyName"],
            "latest": round(float(latest_val)),
            "changes": changes,
            "months": months,
        })

    states = sorted({r["state"] for r in records if r["state"]})
    payload = {
        "latestMonth": latest,
        "monthCols": display_cols,
        "horizons": HORIZONS,
        "states": states,
        "defaultState": "NJ",
        "count": len(records),
        "rows": records,
    }

    raw = json.dumps(payload, separators=(",", ":"))
    with open("data.json", "w") as f:
        f.write(raw)
    # JSON.parse(<string>) loads much faster than a giant JS object literal.
    with open("data.js", "w") as f:
        f.write("window.__HOUSING__ = JSON.parse(")
        f.write(json.dumps(raw))   # raw JSON as a JS string literal
        f.write(");")

    mb = len(raw) / 1e6
    print(f"zips written   : {len(records):,}")
    print(f"states         : {len(states)} (default {payload['defaultState']})")
    print(f"latest month   : {latest}")
    print(f"display months : {display_cols[0]} .. {display_cols[-1]} "
          f"({len(display_cols)} cols)")
    print(f"payload size   : {mb:.1f} MB (uncompressed)")
    nj = sum(1 for r in records if r["state"] == "NJ")
    print(f"NJ zips        : {nj}")


if __name__ == "__main__":
    main()
