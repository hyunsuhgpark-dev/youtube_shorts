# 쇼츠 제목 생성기 (Clip Title Generator)

YouTube Shorts URL을 넣으면 **영상 제목·채널·자막을 자동 수집**하고, OpenAI(`gpt-4o-mini`)로
**핵심 키워드 6~10개 + 후킹 제목 5개 + 해시태그 10개**를 뽑아줍니다.
마음에 드는 제목·해시태그를 골라 **채택안**으로 저장하면 Neon Postgres에 기록이 남습니다.

- 프론트: 정적 `index.html` 한 장 (빌드 없음, 프레임워크 없음)
- 백엔드: Vercel Serverless Functions 2개 (`api/generate.js`, `api/records.js`)
- DB: Neon(Postgres), 테이블 1개 (`clip_records`)

---

## 동작 흐름

```
[사용자] YouTube Shorts URL 입력
   │
   ▼
POST /api/generate  { url, manualText }
   │  1. URL에서 videoId(11자) 추출
   │  2. oEmbed로 제목·채널명 조회
   │  3. youtube-transcript로 자막 텍스트 수집 (실패해도 계속 진행)
   │  4. 위 자료 + 사용자 수동 입력을 프롬프트로 조립
   │  5. OpenAI chat.completions (JSON 모드, temperature 0.8)
   ▼
{ source, keywords[], titles[], hashtags[] }  → 화면에 후보 렌더
   │
   ▼  (사용자가 제목 1개 + 해시태그 여러 개 선택)
POST /api/records  { url, keywords, info, title, hashtags }
   │  clip_records 테이블에 INSERT
   ▼
GET /api/records  → 최근 20건 목록 갱신
```

자막을 못 가져오는 영상(자막 비공개 등)은 프론트의 **"자막을 못 가져올 때: 영상 내용 직접 입력"**
칸에 상황을 적어 보내면 그 텍스트만으로 후보를 생성합니다.

---

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 프론트 전체. 입력 폼 · 후보 표시 · 채택 저장 · 최근 기록 목록. CSS/JS 인라인, 다크모드 대응 |
| `api/generate.js` | `POST /api/generate` — 영상 메타/자막 수집 + OpenAI 호출로 키워드·제목·해시태그 생성 |
| `api/records.js` | `GET /api/records` (최근 20건) / `POST /api/records` (채택안 저장) |
| `schema.sql` | `clip_records` 테이블 + 인덱스 DDL. Neon SQL Editor에서 실행 |
| `package.json` | 의존성 3개: `openai`, `youtube-transcript`, `@neondatabase/serverless` |
| `api.md` | 로컬 전용 OpenAI 키 메모. `.gitignore`에 포함되어 커밋되지 않음 |

---

## API 명세

### `POST /api/generate`

요청 본문:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `url` | string | △ | YouTube Shorts/watch/youtu.be/embed URL 또는 11자 videoId. `manualText`가 있으면 생략 가능 |
| `manualText` | string | △ | 자막 대체용 수동 설명. `url`이 유효하지 않을 때 이 값만으로 생성 |

응답(200):

```json
{
  "source": { "videoId": "abcdefghijk", "title": "영상 제목", "author": "채널명", "hasTranscript": true },
  "keywords": ["키워드1", "키워드2"],
  "titles": ["제목 후보 1", "제목 후보 2", "..."],
  "hashtags": ["#Shorts", "#..."]
}
```

에러:

| 코드 | 상황 |
| --- | --- |
| 400 | `url`도 `manualText`도 없음 |
| 405 | POST가 아님 |
| 422 | 제목·자막·수동입력 모두 확보 실패 |
| 500 | OpenAI 호출 실패 등 서버 오류 |

생성 규칙(프롬프트에 고정): 제목 5개는 각 30자 이내·서로 다른 스타일·낚시 금지,
해시태그 10개는 `#` 포함·공백 없음·`#Shorts` 필수 포함, 자막은 앞 4000자만 사용.

### `GET /api/records`

`clip_records`에서 최근 20건을 `created_at desc`로 반환.

```json
{ "records": [ { "id": 1, "source_url": "...", "keywords": "...", "video_info": "...",
                 "chosen_title": "...", "chosen_hashtags": "...", "created_at": "..." } ] }
```

### `POST /api/records`

요청 본문:

| 필드 | 타입 | 필수 | 저장 컬럼 |
| --- | --- | --- | --- |
| `title` | string | ✅ | `chosen_title` |
| `url` | string | | `source_url` |
| `keywords` | string[] \| string | | `keywords` (배열이면 `, `로 합침) |
| `info` | string | | `video_info` (프론트는 영상 제목을 넣음) |
| `hashtags` | string[] \| string | | `chosen_hashtags` (배열이면 공백으로 합침) |

`title` 누락 시 400.

---

## 데이터베이스 스키마

```sql
create table if not exists clip_records (
  id              serial primary key,
  source_url      text not null default '',
  keywords        text not null default '',
  video_info      text not null default '',
  chosen_title    text not null,
  chosen_hashtags text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists clip_records_created_at_idx on clip_records (created_at desc);
```

이미 이전 버전 테이블이 있으면 `schema.sql` 하단의 `alter table ... add column if not exists`
문장(`source_url`, `keywords`)을 한 줄씩 실행하세요.

---

## 환경 변수

| 이름 | 어디서 쓰나 | 설정 위치 |
| --- | --- | --- |
| `OPENAI_API_KEY` | `api/generate.js` | Vercel → Project → Settings → Environment Variables (로컬 `api.md` 첫 줄 값) |
| `DATABASE_URL` | `api/records.js` | Vercel → Storage에서 Neon 연결 시 **자동 주입** |

---

## 배포 순서 (GitHub → Vercel → Neon)

1. **GitHub 저장소 생성 후 이 폴더 push**
   `api.md`는 `.gitignore`에 있어 올라가지 않습니다.
2. **Vercel → Add New → Project → 방금 저장소 Import**
   Framework Preset: **Other**, 나머지 기본값으로 **Deploy**.
3. **Vercel → Storage → Create Database → Neon(Postgres) → 이 프로젝트에 Connect**
   연결하면 `DATABASE_URL`이 자동으로 환경변수에 추가됩니다.
4. **Neon 대시보드 → SQL Editor에서 `schema.sql` 내용 실행** (한 문장씩)
5. **Vercel → Project → Settings → Environment Variables**
   `OPENAI_API_KEY` = 로컬 `api.md` 첫 줄의 키 값 추가.
6. **Deployments → 최신 배포 Redeploy** (환경변수 반영)
7. 배포 URL 접속 → Shorts URL 넣고 **분석 & 후보 생성** 테스트.

---

## 로컬에서 돌려보기 (선택)

Vercel CLI가 있으면 로컬에서도 서버리스 함수를 띄울 수 있습니다.

```bash
npm install
# 프로젝트 루트에 .env.local 생성
#   OPENAI_API_KEY=sk-...
#   DATABASE_URL=postgres://...   (Neon 연결 문자열)
npx vercel dev
```

`index.html`을 파일로만 열면 `/api/*` 호출이 동작하지 않습니다. 반드시 `vercel dev`로 함께 띄우세요.

---

## 알려진 한계

- `youtube-transcript`는 자막이 비공개거나 지역 제한된 영상에서 실패합니다 → 수동 입력으로 우회.
- OpenAI 응답이 지정 JSON 형식을 벗어나면 해당 배열이 빈 값으로 처리됩니다(에러는 아님).
- 인증·사용량 제한이 없으므로 배포 URL이 공개되면 누구나 OpenAI 비용을 유발할 수 있습니다.
- 기록 목록은 최근 20건 고정, 페이지네이션·검색·삭제 UI 없음.
