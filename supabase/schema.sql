-- CONNECT-K starter database. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text unique not null check(char_length(username) between 3 and 24),display_name text not null check(char_length(display_name) between 1 and 60),avatar_url text,bio text check(bio is null or char_length(bio)<=240),institution text,interests text[] not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.profiles enable row level security;
create policy "Authenticated users can view public profile fields" on public.profiles for select to authenticated using(true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check(auth.uid()=id);
create policy "Users update own profile" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,username,display_name) values(new.id,coalesce(lower(nullif(trim(new.raw_user_meta_data->>'username'),'')),'user_'||substr(new.id::text,1,8)),coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'New member')) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.connection_requests(id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles(id) on delete cascade,receiver_id uuid not null references public.profiles(id) on delete cascade,status text not null default 'pending' check(status in('pending','accepted','declined','cancelled')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(sender_id<>receiver_id),unique(sender_id,receiver_id));
alter table public.connection_requests enable row level security;
create policy "Participants view requests" on public.connection_requests for select to authenticated using(auth.uid()=sender_id or auth.uid()=receiver_id);
create policy "Users send requests" on public.connection_requests for insert to authenticated with check(auth.uid()=sender_id);
create policy "Participants update requests" on public.connection_requests for update to authenticated using(auth.uid()=sender_id or auth.uid()=receiver_id) with check(auth.uid()=sender_id or auth.uid()=receiver_id);

create table if not exists public.conversations(id uuid primary key default gen_random_uuid(),conversation_type text not null default 'direct' check(conversation_type in('direct','group')),title text,created_by uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now());
create table if not exists public.conversation_members(conversation_id uuid not null references public.conversations(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,joined_at timestamptz not null default now(),primary key(conversation_id,user_id));
create table if not exists public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,sender_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 5000),created_at timestamptz not null default now());
alter table public.conversations enable row level security;alter table public.conversation_members enable row level security;alter table public.messages enable row level security;
create policy "Members view conversations" on public.conversations for select to authenticated using(exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy "Users create conversations" on public.conversations for insert to authenticated with check(auth.uid()=created_by);
create policy "Users view own memberships" on public.conversation_members for select to authenticated using(user_id=auth.uid());
create policy "Creator adds conversation members" on public.conversation_members for insert to authenticated with check(exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid()) or user_id=auth.uid());
create policy "Members read messages" on public.messages for select to authenticated using(exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "Members send own messages" on public.messages for insert to authenticated with check(auth.uid()=sender_id and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create table if not exists public.communities(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 80),description text,created_by uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now());
create table if not exists public.community_members(community_id uuid not null references public.communities(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,role text not null default 'member' check(role in('owner','admin','member')),joined_at timestamptz not null default now(),primary key(community_id,user_id));
alter table public.communities enable row level security;alter table public.community_members enable row level security;
create policy "Authenticated view communities" on public.communities for select to authenticated using(true);
create policy "Users create communities" on public.communities for insert to authenticated with check(auth.uid()=created_by);
create policy "Authenticated view community memberships" on public.community_members for select to authenticated using(true);
create policy "Users join communities" on public.community_members for insert to authenticated with check(auth.uid()=user_id);
create policy "Users leave communities" on public.community_members for delete to authenticated using(auth.uid()=user_id);
-- Email addresses remain in Supabase Auth and are not included in public profiles.
-- Review and harden policies before enabling public launch.
