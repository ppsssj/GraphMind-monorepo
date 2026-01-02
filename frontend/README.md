````md
# GraphMind Frontend

GraphMind의 UI/시각화(2D/3D 그래프, Vault/Studio 워크플로우)를 담당하는 프론트엔드입니다.

---

## Tech Stack
- React + Vite
- Three.js / @react-three/fiber / drei
- Math.js (수식 파싱/연산)
- Panel 기반 UI (Vault ↔ Studio)

---

## Requirements
- Node.js v18+

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
````

* Dev Server: `http://localhost:5173`

---

## Environment Variables

`.env`는 커밋하지 않습니다. 필요 시 아래 형태로 구성하세요.

예시: `frontend/.env`

```bash
VITE_API_BASE_URL=http://localhost:8080
```

권장: 공유용으로 `frontend/.env.example`를 두고, 실제 값은 각자 `.env`로 관리합니다.

---

## Scripts

```bash
npm run dev       # local dev
npm run build     # production build
npm run preview   # preview build
```

---

## Project Structure (Key)

```text
frontend/
  src/
    api/
      apiClient.js
    components/
    pages/
    ui/
```

---

## Pages (MVP)

* `Intro` : 랜딩/제품 소개
* `Vault` : 수식/그래프 리소스 탐색(리스트/그래프 뷰) + Studio 이동
* `Studio` : Graph / Curve3D / Surface3D / Array3D 편집

---

## API Integration

* 공통 API 클라이언트: `src/api/apiClient.js`
* baseURL: `VITE_API_BASE_URL`

---

## Notes

* Node-based editing(Alt editing 등)과 bidirectional sync(Equation ↔ Graph)는 Studio 중심으로 동작합니다.
* 백엔드가 MVP(In-memory) 구조이므로 데이터 지속성/권한 모델은 추후 확장 대상입니다.


