# GraphMind

GraphMind는 **수식 ↔ 그래프(2D/3D) 양방향 동기화**를 중심으로, **시각화·편집·저장(Vault)·히스토리·AI 보조**를 한 화면에서 연결하는 인터랙티브 수학/그래프 스튜디오입니다.

> 목표: “수식을 입력하면 끝”이 아니라, **그래프를 만지고(노드/제어점)** → **수식이 바뀌고** → 그 결과를 **지식(Vault)로 축적**하는 워크플로를 제공합니다.

---

## 주요 기능

### 1) Graph / Curve / Surface 뷰 & 캔버스
- **Graph(2D)**: 좌표계/그리드 기반 그래프 렌더링, 포인트/노드 편집 UX
- **Curve(3D Parametric)**: `x(t), y(t), z(t)` 형태의 곡선 생성 및 인터랙션
- **Surface(3D)**: `z = f(x, y)` 또는 등가 형태의 3D 표면 시각화
- **공통 UX**
  - 확대/축소/회전/팬(카메라 컨트롤)
  - 선택/하이라이트, 오브젝트 중심 자동 줌(Inspect/Fit)
  - 안전한 재렌더링(축/그리드 흔들림 최소화 설계)

### 2) Studio: 편집 중심 작업 공간
- 그래프 위에서 **노드(제어점) 드래그**로 기하 형태를 수정
- 수정 사항을 즉시 반영하여 **수식/파라미터 업데이트**
- **되돌리기(Undo)/다시하기(Redo)** 확장 가능한 구조(리듀서 기반)

### 3) 수식 ↔ 그래프 양방향 동기화
- 수식 입력 → 그래프 생성(렌더러)
- 그래프 조작(노드 이동/추가/삭제) → 수식 또는 파라미터 값 갱신
- “결과만 그리는” 방식이 아니라, **편집 상태(State)를 중심으로 동작**합니다.

### 4) AI Panel (수식 도우미 / 그래프 조작 / 질의응답)
- 수식 해석, 그래프 특성(절편/극값/대칭 등) 질의
- 작업 히스토리/현재 그래프 상태를 기반으로 **작업 제안**(설계 확장 포인트)
- 결과를 **Markdown/수식(KaTeX) 렌더링**으로 표시(가독성 강화)

### 5) History & Audit Trail
- 사용자 입력/AI 응답/그래프 변환 이벤트를 타임라인처럼 관리
- 특정 시점 상태로 복원 가능한 형태로 확장 가능(스냅샷/패치 모델)

### 6) Vault (지식 저장소)
- 그래프/수식/메모/태그를 저장하고 리스트/클러스터 형태로 탐색
- Vault 항목에서 **Studio로 바로 전환**하여 편집/확장 작업 수행
- 태그 기반 분류/검색 UI 확장 용이

### 7) Import / Export
- JSON 기반 상태 저장/복원(그래프 타입별 State 스키마)
- 추후: 이미지/벡터(예: SVG) 내보내기, 프로젝트 단위 묶음(Workspace) 지원 가능

### 8) UI/UX 품질 요소
- Obsidian/VS Code 스타일의 **패널 기반 레이아웃**
- 툴바 메타/경고/모노스페이스 정보 영역 확장(디버그/상태 확인 용이)
- 스크롤/리스트/패널 리사이즈 등 “앱 같은 사용감”을 지향

---

## 워크플로(사용자 흐름)

```mermaid
flowchart LR
  U[User] --> I[Input: Equation / Natural Language]
  I --> R[Renderer: Graph / Curve / Surface]
  R --> E[Studio Editor: Node/Control Editing]
  E <--> S[Bidirectional Sync\nEquation ↔ Graph State]
  S --> H[History / AI History]
  S --> V[Vault: Save / Tag / Cluster]
  V -->|Open in Studio| E
  H --> B[Backend API (optional)]
  B --> V
  B --> H
```

---

## 기술 스택

### Frontend
- React
- Three.js (via @react-three/fiber, @react-three/drei)
- mathjs (수식 파싱/컴파일)
- KaTeX (수식 렌더링)
- Tailwind CSS (프로젝트 설정에 따라)

### Backend (선택)
- Spring Boot 기반 API 또는 Node/Express 기반 API로 확장 가능
- Health 체크, Vault/History 저장, AI 호출 프록시 등

> 현재 구현 상태에 따라 백엔드는 “선택/확장”으로 두는 것을 권장합니다.

---

## 프로젝트 구조(예시)

> 실제 폴더/파일명은 레포 상태에 맞춰 조정하세요.

```
GraphMind/
  frontend/
    src/
      pages/        # Studio, Vault 등 라우트 페이지
      ui/           # Canvas, Overlay, Toolbar, Panels
      components/   # 재사용 컴포넌트
      data/         # 더미/샘플 데이터 (예: dummyEquations.js)
      styles/       # CSS 분리 규칙 적용 시
  backend/          # (선택) Spring Boot 또는 API 서버
  README.md
```

---

## 로컬 실행

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend (선택)
```bash
cd backend
# Spring Boot
./gradlew bootRun
```

---

## 환경변수(.env) 가이드

- `.env`는 **Git에 커밋하지 않도록** `.gitignore`에 포함하세요.
- 예시:
  - `VITE_API_BASE_URL=http://localhost:8080`
  - `VITE_OPENAI_PROXY_URL=/api/ai` (프록시 구성 시)

---

## Roadmap (제안)

- [ ] Vault: 태그 검색/클러스터 시각화 강화(그래프 기반 뷰)
- [ ] History: 상태 스냅샷/패치 기반 Undo/Redo 고도화
- [ ] Export: SVG/PNG/PDF 내보내기 + 프로젝트 번들링
- [ ] Backend: Vault/History 영속화, 사용자 인증, 권한 분리
- [ ] AI: “그래프 조작 명령” 표준화(안전한 액션 스키마)

---

## License
프로젝트 라이선스는 레포 정책에 맞춰 추가하세요. (예: MIT)
