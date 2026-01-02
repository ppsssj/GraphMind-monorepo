# 🌐 GraphMind (MVP)

**GraphMind**는 사용자가 입력한 **수식 및 자연어 기반 명령어를 2D/3D 그래프로 시각화**하고, **노드 기반 편집(Node Manipulation)**을 통해 수학적 구조를 직관적으로 탐색할 수 있도록 설계된 데스크탑 애플리케이션입니다.  
학습·연구·데이터 시각화 워크플로우를 하나의 인터페이스로 통합하는 것을 목표로 합니다.

---

##  Screenshots

### 1) Landing (Product Intro)
![GraphMind Landing](assets/landing.png)

### 2) Vault (Graph-based Knowledge / Tag Clustering)
![GraphMind Vault](assets/vault.png)

### 3) Studio (Graph, Curve3D, Surface3D, Array3D Editing)

| Graph | Curve3D |
|---|---|
| ![Graph](assets/graph.png) | ![Curve3D](assets/curve3d.png) |

| Surface3D | Array3D |
|---|---|
| ![Surface3D](assets/surface3d.png) | ![Curve3D](assets/array3d.png) |


---

##  프로젝트 개요

- **목표**
  - 자연어/수식 입력 → 그래프(2D/3D) 생성 및 시각화
  - 노드 기반 조작으로 그래프 형태를 편집하고, **수식과 그래프를 양방향 동기화**
  - Vault 기반으로 수식/그래프 리소스를 축적하고 태그로 연결하여 재사용 가능한 지식 그래프 구성

- **개발 인원**: 개인 프로젝트 (Full-Stack 역할 수행)

- **주요 성과**
  - Electron 기반 멀티 플랫폼 구조 (Windows/macOS/Linux 타겟)
  - 수식 파싱 → 실시간 3D 렌더링 파이프라인 구축
  - VS Code / Obsidian 스타일의 미니멀 UI + 패널 기반 워크플로우 설계
  - Vault(지식 그래프) ↔ Studio(편집) 이동 동선 확립

---

##  기술 스택

- **Frontend / Visualization**
  - Three.js (3D 렌더링)
  - Math.js (수식 파싱 및 연산)
  - React + Vite (UI/번들링)

- **Application Framework**
  - Electron (데스크탑 런타임)

- **개발 환경**
  - Visual Studio Code
  - Node.js (v18+)

---

##  주요 기능

### 1) Equation / Natural Language Input
- `z = x^2 + y^2`, `sin(x)*cos(y)` 등 수식 입력 지원
- (확장) 자연어 명령을 통한 생성/조작 플로우 설계

### 2) 3D Graph Visualization (Surface / Curve / etc.)
- 회전/확대/축소 등 마우스 기반 탐색
- 좌표축 및 격자(Grid) 출력
- 범위(xMin/xMax, yMin/yMax) 및 샘플링(nx/ny) 조절

### 3) Node-Based Graph Manipulation
- 노드를 드래그하여 그래프 형태를 직관적으로 편집
- 편집 모드(예: Alt Editing)에서 포인트 추가/삭제 및 선택 조작 지원

### 4) Bidirectional Sync (Graph ↔ Equation)
- 그래프 편집 결과를 수식에 반영
- 수식 변경을 그래프 렌더링에 즉시 반영  
  *(실시간 반영 + 디바운스 적용)*

### 5) Vault (Knowledge Graph)
- 수식/그래프 리소스를 Vault에 저장
- 태그/노드 관계 기반으로 클러스터링 및 탐색
- “Open in Studio”로 편집 환경 전환

---

##  Getting Started

```bash
# install
npm install

# dev
npm run dev

# electron (if separated scripts exist)
npm run electron
