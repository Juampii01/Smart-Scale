-- Tabla para requests de diagnóstico AI
create table if not exists public.ai_diagnosis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prompt text not null,
  audit_type text,
  annual_revenue text,
  selected_month text,
  client_id uuid,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla para resultados de diagnóstico AI
create table if not exists public.ai_diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.ai_diagnosis_requests(id) on delete cascade,
  result text,
  raw_response jsonb,
  created_at timestamptz default now()
);

-- Índices útiles
create index if not exists idx_ai_diag_user_id on public.ai_diagnosis_requests(user_id);
create index if not exists idx_ai_diag_request_id on public.ai_diagnosis_results(request_id);
