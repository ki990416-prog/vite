# Jeju Site (Vite + Supabase + Pixabay)

제주도 소개 사이트. Supabase 이메일 회원가입/로그인, Pixabay 이미지 갤러리, Vercel 배포.
비회원은 사진 6장, 로그인하면 24장까지 볼 수 있습니다.

## 로컬 실행 (Node.js 18+ 필요)
```bash
npm install
copy .env.example .env   # 값 채우기
npm run dev
```

## 환경변수
| 이름 | 위치 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | 같은 화면의 `anon` `public` key (service_role 키는 절대 사용 금지) |
| `VITE_PIXABAY_API_KEY` | https://pixabay.com/api/docs/ (로그인 후 키 표시) |

Vercel에도 같은 3개를 Project Settings > Environment Variables에 등록 후 재배포.
Supabase > Authentication > URL Configuration에 배포 URL을 Site URL / Redirect URLs로 추가.
