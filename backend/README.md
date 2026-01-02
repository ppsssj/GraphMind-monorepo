````md
# GraphMind Backend (MVP)

GraphMind의 Vault/Studio/History/Auth 등 API를 제공하는 Spring Boot 백엔드입니다.  
현재는 MVP 단계로 In-memory 저장소 기반이며, DB 연동은 추후 확장 대상입니다.

---

## Tech Stack
- Java + Spring Boot
- Gradle Wrapper

---

## Requirements
- JDK 17+ (권장)
- (테스트) Postman / curl

---

## Run

### Windows
```bash
cd backend
gradlew.bat bootRun
````

### macOS/Linux

```bash
cd backend
./gradlew bootRun
```

* Base URL: `http://localhost:8080`

---

## Health Check

```bash
GET http://localhost:8080/health
```

---

## API (MVP)

프로젝트는 컨트롤러 단위로 기능이 구성됩니다.

* `HealthController` : 서버 상태 확인
* `AuthController` : 로그인/토큰 관련
* `MeController` : 현재 사용자 정보
* `VaultController` : Vault 리소스 저장/조회
* `StudioController` : Studio 프로젝트 저장/조회
* `HistoryController` : 사용 기록/이벤트
* `AiHistoryController` : AI 대화/결과 기록

> 실제 URL 경로/메서드는 각 Controller의 `@RequestMapping`, `@GetMapping`, `@PostMapping` 정의를 기준으로 합니다.

---

## Auth (MVP)

* Filter 기반 인증: `config/AuthFilter`
* 토큰 저장/검증: `repo/TokenStore`
* CORS 설정: `config/CorsConfig`

---

## Storage (MVP)

* In-memory 저장소: `repo/InMemoryStore`
* AI History 저장소: `service/storage/AiHistoryStore`

추후 확장:

* DB(PostgreSQL 등) 영속화
* Redis 기반 토큰/세션 관리

---

## Configuration

* `src/main/resources/application.properties`
* `.env`는 커밋 금지 (필요 시 `.env.example`로 공유 권장)

---

## Test

### Windows

```bash
cd backend
gradlew.bat test
```

### macOS/Linux

```bash
cd backend
./gradlew test
```

---

## Roadmap (Backend)

* In-memory → DB 영속화
* 인증/권한 정책 고도화 (JWT/Refresh, role-based access)
* OpenAPI(Swagger)로 엔드포인트 문서화

```
```
