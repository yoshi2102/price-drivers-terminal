-- Serving and warehouse schema (Postgres, Mumbai region).
-- The worker writes; the web app reads model_output through a read-only role.
-- Rule: no model or screen reads a value whose known_at is after its as-of date.

create table security (
  security_id text primary key, nse_code text unique not null, bse_code text, name text not null,
  sector text not null, sub_sector text, listing_date date, delisting_date date
);
create table price_daily (
  security_id text references security, date date, open numeric, high numeric, low numeric, close numeric,
  adj_close numeric, volume bigint, adj_factor numeric default 1, primary key (security_id, date)
);
create table index_daily (index_id text, date date, close numeric, primary key (index_id, date));
create table fundamental (
  security_id text references security, basis text check (basis in ('standalone','consolidated')), data_class text,
  period text, field text, value_crore numeric, unit_raw text, known_at timestamptz not null, source_tag text not null,
  primary key (security_id, basis, data_class, period, field, known_at)
);
create table kpi (
  security_id text references security, period text, kpi_code text, value numeric, unit text,
  known_at timestamptz not null, source_tag text not null, extraction_confidence numeric,
  primary key (security_id, period, kpi_code, known_at)
);
create table consensus_snapshot (
  security_id text references security, snapshot_date date, fiscal_year text, metric text,
  mean numeric, median numeric, high numeric, low numeric, n_estimates int, source text,
  primary key (security_id, snapshot_date, fiscal_year, metric)
);
create table broker_estimate (
  note_id text, security_id text references security, broker text, analyst text, note_date date, fiscal_year text,
  metric text, value numeric, target_price numeric, rating text, source_doc_id text not null,
  extraction_confidence numeric, review_status text default 'auto', primary key (note_id, fiscal_year, metric)
);
-- Macro: first release kept; revisions are new vintages, never overwrites.
create table macro (series_id text, period text, value numeric, release_date date, vintage int, primary key (series_id, period, vintage));
create table flow (series_id text, date date, value numeric, known_at timestamptz, primary key (series_id, date));
create table event (security_id text references security, event_type text, event_ts timestamptz, payload_json jsonb);
create table model_run (
  run_id text primary key, model_code text, version text, universe text, train_end date,
  params_json jsonb, code_hash text not null, data_snapshot_id text not null, created_at timestamptz default now()
);
create table model_output (
  run_id text references model_run, security_id text, as_of date, output_type text, payload_json jsonb,
  primary key (run_id, security_id, as_of, output_type)
);
-- Append-only: revoke update/delete from every role.
create table experiment (
  exp_id text primary key, hypothesis text not null, analyst text not null, created_at timestamptz default now(),
  n_tests int, raw_p numeric, adjusted_p numeric, verdict text
);
create table published_snapshot (snapshot_id text primary key, published_at timestamptz default now(), is_current boolean default false);
create unique index one_current_snapshot on published_snapshot (is_current) where is_current;
create table app_user (email text primary key, role text check (role in ('admin','editor','viewer')) not null);
create table audit_log (at timestamptz default now(), email text, action text, detail jsonb);
create table studio_pack (
  pack_id text primary key, name text, kind text, status text check (status in ('draft','in_review','approved_internal','approved_external')),
  owner text references app_user, items jsonb, updated_at timestamptz default now()
);

-- Point-in-time read helper used by every model.
create view fundamental_pit as select * from fundamental;  -- filter: where known_at <= :as_of
revoke update, delete on experiment from public;
