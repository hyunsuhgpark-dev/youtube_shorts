-- Neon SQL Editor에 붙여넣고 1회 실행
create table if not exists clip_records (
  id              serial primary key,
  video_info      text not null,
  chosen_title    text not null,
  chosen_hashtags text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists clip_records_created_at_idx
  on clip_records (created_at desc);
