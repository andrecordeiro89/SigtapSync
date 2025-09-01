from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import pandas as pd
import numpy as np


INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "dev-token")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

app = FastAPI(title="SIGTAP Analytics Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"]
)


class Filters(BaseModel):
    dateStart: Optional[str] = None
    dateEnd: Optional[str] = None
    hospitals: Optional[List[str]] = None
    specialty: Optional[str] = None
    careCharacter: Optional[str] = None
    topN: Optional[int] = 6


class Row(BaseModel):
    doctor_id: Optional[str]
    doctor_name: str
    doctor_cns: Optional[str]
    discharge_date: str
    aih_value: float


class Payload(BaseModel):
    filters: Filters
    rows: List[Row]


def auth_guard(token: Optional[str]):
    if not token or token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/analytics/ranking")
def ranking(payload: Payload, x_internal_token: Optional[str] = Header(None)):
    auth_guard(x_internal_token)
    if not payload.rows:
        return {"ranking": []}
    df = pd.DataFrame([r.model_dump() for r in payload.rows])
    df["aih_value"] = pd.to_numeric(df["aih_value"], errors="coerce").fillna(0.0)
    grp = df.groupby("doctor_name").agg(total=("aih_value", "sum"), cnt=("aih_value", "size"))
    grp["avg"] = grp["total"] / grp["cnt"].replace(0, np.nan)
    grp = grp.sort_values("avg", ascending=False)
    topn = int(payload.filters.topN or 6)
    out = [
        {"doctor": name, "avg": float(row["avg"]) if row["cnt"] > 0 else 0.0}
        for name, row in grp.head(topn).iterrows()
    ]
    return {"ranking": out}


@app.post("/analytics/series")
def series(payload: Payload, x_internal_token: Optional[str] = Header(None)):
    auth_guard(x_internal_token)
    if not payload.rows:
        return {"series": [], "bins": []}
    df = pd.DataFrame([r.model_dump() for r in payload.rows])
    df["discharge_date"] = pd.to_datetime(df["discharge_date"], errors="coerce")
    df["aih_value"] = pd.to_numeric(df["aih_value"], errors="coerce").fillna(0.0)
    # Daily average per doctor
    daily = df.groupby(["doctor_name", pd.Grouper(key="discharge_date", freq="D")]).agg(
        avg=("aih_value", "mean")
    ).reset_index()
    # Weekly average per doctor from daily
    weekly = daily.copy()
    weekly["week"] = weekly["discharge_date"].dt.to_period("W").apply(lambda r: r.start_time)
    weekly = weekly.groupby(["doctor_name", "week"]).agg(avg=("avg", "mean")).reset_index()
    # bins
    bins = sorted(weekly["week"].dropna().unique())
    bins_iso = [b.strftime("%Y-%m-%d") for b in bins]
    series = []
    for doctor, g in weekly.groupby("doctor_name"):
        vals = {row.week.strftime("%Y-%m-%d"): float(row.avg) for _, row in g.iterrows()}
        series.append({
            "doctor": doctor,
            "values": [vals.get(b, None) for b in bins_iso]
        })
    return {"bins": bins_iso, "series": series}


@app.post("/analytics/share")
def share(payload: Payload, x_internal_token: Optional[str] = Header(None)):
    auth_guard(x_internal_token)
    if not payload.rows:
        return {"share": []}
    df = pd.DataFrame([r.model_dump() for r in payload.rows])
    df["aih_value"] = pd.to_numeric(df["aih_value"], errors="coerce").fillna(0.0)
    grp = df.groupby("doctor_name").agg(total=("aih_value", "sum")).reset_index()
    total = grp["total"].sum()
    grp["pct"] = (grp["total"] / total).replace([np.inf, -np.inf], 0).fillna(0) * 100
    grp = grp.sort_values("total", ascending=False)
    out = [
        {"doctor": str(row.doctor_name), "value": float(row.total), "pct": float(row.pct)}
        for _, row in grp.iterrows()
    ]
    return {"share": out}


@app.get("/health")
def health():
    return {"ok": True}


