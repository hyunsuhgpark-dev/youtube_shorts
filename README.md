# 클립 제목 생성기

영상 정보 입력 → OpenAI(`gpt-4o-mini`)로 제목 5개 + 해시태그 10개 생성 → 채택안을 Neon Postgres에 기록.

## 구성
- `index.html` — 프론트(폼 + 후보 + 기록 목록)
- `api/generate.js` — POST `/api/generate` `{ info }` → `{ titles[], hashtags[] }`
- `api/records.js` — GET `/api/records` (최근 20건) / POST `{ info, title, hashtags[] }`
- `schema.sql` — 테이블 1개

## 배포 순서 (GitHub → Vercel)

1. **GitHub 저장소 생성 후 이 폴더 push** (`api.md`는 `.gitignore`에 포함되어 올라가지 않음)
2. **Vercel → Add New → Project → 방금 저장소 Import** (프레임워크: Other, 설정 그대로 Deploy)
3. **Vercel → Storage → Create Database → Neon(Postgres) 선택 → 이 프로젝트에 Connect**
   - 연결하면 `DATABASE_URL` 환경변수가 자동 주입됨
4. **Neon 대시보드 → SQL Editor 에 `schema.sql` 내용 붙여넣고 실행**
5. **Vercel → Project → Settings → Environment Variables**
   - `OPENAI_API_KEY` = (로컬 `api.md` 첫 줄의 키 값)
6. **Deployments → 최신 배포 Redeploy** (env 반영)
7. 배포 URL 접속해서 테스트

## 로컬 참고
`api.md` 는 OpenAI 키가 들어있어 커밋되지 않습니다. 키 값은 6번 단계에서 Vercel에 직접 입력하세요.
