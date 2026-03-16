-- 1. Function: create profile when a user signs up (auth.users insert)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Trigger: run the function after insert OR update (covers confirmed_at being set)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Enable RLS (no policies = anon key has no access; backend service_role bypasses RLS)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.topics enable row level security;
alter table public.subtopics enable row level security;
alter table public.subtopic_progress enable row level security;
alter table public.topic_completions enable row level security;
alter table public.project_invites enable row level security;
