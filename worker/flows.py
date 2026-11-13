"""Scheduled flows (IST). Deploy on Modal or a Buoyant VM; each flow ends by
calling pdt.run, which publishes a new snapshot only if every stage passes.

  Prices, indices, flows, commodities   daily 18:30
  Consensus snapshots                   daily 20:00
  Broker note extraction                every 2 h, 08:00-22:00
  Results ingestion                     within 6 h of each filing
  Factor model + event studies          nightly
  Panel, broker scores, forward paths   Sunday + after each results season

Ingestion from Airavat currently runs through Claude's Airavat connector
(scheduled Claude runs write raw JSON into PDT_RAW_DIR). Swap `pull_*` for
direct API calls once Labs issues service keys.
"""
from __future__ import annotations

try:
    from prefect import flow, task
except ImportError:  # run without Prefect
    def flow(fn=None, **_):
        return fn if fn else (lambda f: f)
    task = flow

from pdt import run as pipeline


@task(retries=2, retry_delay_seconds=300)
def publish():
    pipeline.main()


@flow(name="pdt-nightly")
def nightly():
    publish()


if __name__ == "__main__":
    nightly()
