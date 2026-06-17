-- 0007: 패치노트 게시판
--
-- 웹(/app/patch-notes 슈퍼관리자 작성, /patch 공개 열람)에서 글을 올리고,
-- 디스코드 "/패치노트"가 최신 published 글 1건을 보여준다.
-- 0003과 동일한 RLS 패턴: 공개 읽기(published) + 슈퍼관리자 쓰기(is_super).

create table if not exists public.patch_posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,           -- 마크다운/텍스트 본문(섹션·불릿·출처 포함)
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists patch_posts_created_idx
  on public.patch_posts (created_at desc);

alter table public.patch_posts enable row level security;

drop policy if exists patch_posts_select on public.patch_posts;
create policy patch_posts_select on public.patch_posts
  for select using (published);

drop policy if exists patch_posts_insert on public.patch_posts;
create policy patch_posts_insert on public.patch_posts
  for insert to authenticated with check (public.is_super());

drop policy if exists patch_posts_update on public.patch_posts;
create policy patch_posts_update on public.patch_posts
  for update to authenticated using (public.is_super()) with check (public.is_super());

drop policy if exists patch_posts_delete on public.patch_posts;
create policy patch_posts_delete on public.patch_posts
  for delete to authenticated using (public.is_super());
