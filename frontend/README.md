# GraphMind Frontend

GraphMind의 UI/시각화(2D/3D 그래프, Vault/Studio 워크플로우)를 담당하는 프론트엔드입니다.

- Root 문서: `../README.md`
- Backend 문서: `../backend/README.md`

## Stack
- React + Vite
- Three.js (`@react-three/fiber`, `@react-three/drei`)
- Math.js

## Requirements
- Node.js v18+

## Run (Local)
```bash
cd frontend
npm install
npm run dev
```

- URL: `http://localhost:5173`

## Configuration
`.env`는 커밋하지 않습니다. 공유용으로 `.env.example`만 커밋합니다.

1) `frontend/.env.example` 생성
```env
VITE_API_BASE_URL=http://localhost:8080
```

2) 로컬 실행 시 `frontend/.env`로 복사
```bash
cp .env.example .env
```

## Scripts
```bash
npm run dev       # local dev
npm run build     # production build
npm run preview   # preview build
```

## Project Structure (Key)
```text
frontend/
  src/
    api/          # apiClient 및 요청 래퍼
    components/   # UI 컴포넌트
    pages/        # Intro, Vault, Studio
    ui/           # 재사용 UI/스타일
```

## Pages (MVP)
- `Intro` : 랜딩/제품 소개
- `Vault` : 수식/그래프 리소스 탐색(리스트/그래프 뷰) + Studio 이동
- `Studio` : Graph / Curve3D / Surface3D / Array3D 편집

## API Integration
- 공통 API 클라이언트: `src/api/apiClient.js`
- baseURL: `VITE_API_BASE_URL`

## Notes
- 백엔드 미기동/주소 불일치 시 API 요청이 실패합니다. (`VITE_API_BASE_URL`, CORS 확인)
- Node-based editing(Alt editing 등)과 bidirectional sync(Equation ↔ Graph)는 Studio 중심으로 동작합니다.
- 백엔드는 MVP(In-memory) 구조이므로 데이터 지속성/권한 모델은 추후 확장 대상입니다.
