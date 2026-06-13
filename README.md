# US Housing Price Dashboard

**🔗 Live demo: https://tradernish.github.io/nj-housing-dashboard/**

A single-page dashboard of Zillow ZHVI home values for **every US zip code**
(~26,000 zips across 51 states/DC), with 1mo / 3mo / 6mo / 1yr / 3yr / 5yr price
changes and the last 60 months of monthly values. The state filter **defaults to NJ**;
switch it to any state or "All states". No backend — open `index.html` in a browser
(or use the live demo above).

![dashboard](https://img.shields.io/badge/data-Zillow%20ZHVI-blue)

> The repo is named `nj-housing-dashboard` for historical reasons (it started as
> NJ-only); it now covers the whole US.

## Features

- One row per zip: zip, city, county, state, latest price, 6 change columns, 60 monthly
  columns (collapsible / horizontally scrollable).
- Click any column header to sort ascending / descending.
- Filters: zip/city text search, **state dropdown (defaults to NJ)**, county dropdown
  (scoped to the selected state), dual sliders on latest price and on 1-year change.
- Change cells colored green (gain) / red (loss), intensity scaling with magnitude.
- Live filtered row count.

## Files

| File | Purpose |
|------|---------|
| `process.py`   | Reads the raw Zillow CSV, filters to NJ, computes change columns, writes `data.json` + `data.js`. |
| `data.json`    | Cleaned dataset (deliverable). |
| `data.js`      | Same payload as `window.__HOUSING__` so the page loads from `file://` with no server. |
| `index.html`   | The dashboard (plain HTML + JS, no build step). |
| `smoke.mjs`    | jsdom smoke test of rendering, sorting, and filters. |

## Regenerate the data

The raw download (`zhvi_zip.csv`, ~116 MB) is gitignored. To rebuild:

```bash
# 1. Download the current zip-level ZHVI CSV (smoothed, seasonally adjusted)
curl -L -o zhvi_zip.csv \
  "https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
# If that 404s, grab the current link from https://www.zillow.com/research/data/

# 2. Build the cleaned data
pip install pandas numpy
python3 process.py
```

Change columns are computed off the **full** monthly series (positional month offset),
so the 5-year / 60-month lookback is exact even though only the last 60 months are kept
for display. Missing lookback months yield `null`, never a fabricated value.

## Run the smoke test

```bash
npm install        # installs jsdom
node smoke.mjs
```

## Data source

Zillow Home Value Index (ZHVI), All Homes (SFR + condo/co-op), 35th–65th percentile tier,
smoothed & seasonally adjusted. <https://www.zillow.com/research/data/>
