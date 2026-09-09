-- Neon SQL Editor에서 한 문장씩 실행하세요.

-- 새 DB인 경우: 전체 테이블 생성
create table if not exists clip_records (
  id              serial primary key,
  source_url      text not null default '',
  keywords        text not null default '',
  video_info      text not null default '',
  chosen_title    text not null,
  chosen_hashtags text not null default '',
  created_at      timestamptz not null default now()
);

-- 인덱스
create index if not exists clip_records_created_at_idx on clip_records (created_at desc);

-- 이미 테이블을 만든 경우: 컬럼 2개만 추가 (한 문장씩 실행)
alter table clip_records add column if not exists source_url text not null default '';
alter table clip_records add column if not exists keywords text not null default '';
alter table clip_records alter column video_info set default '';
