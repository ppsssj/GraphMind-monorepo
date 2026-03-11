# GraphMind Frontend

Frontend for GraphMind Vault and Studio.

## Stack

- React 19
- CRA (`react-scripts` 5) with `craco`
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Math.js

## Requirements

- Node.js 22 LTS

## Run

```bash
cd frontend
nvm use
npm install
npm start
```

- Default URL: `http://localhost:3000`

## Environment

Create `frontend/.env` from `frontend/.env.example`.

```env
REACT_APP_API_BASE=http://localhost:8080
REACT_APP_API_DEBUG=0
```

## Scripts

```bash
npm start
npm run build
npm test -- --watchAll=false
```

## Version Pinning

- `.nvmrc` pins the frontend to Node 22.
- `package.json` also declares `engines.node` as `22.x`.
- This project currently expects Node 22 LTS rather than Node 24 because the CRA override path is validated there.

## Key Paths

```text
frontend/
  src/api/
  src/components/
  src/pages/
  src/ui/
```

## Notes

- API base URL is read from `REACT_APP_API_BASE`.
- The app uses React Router and opens Vault resources in Studio with route state.
- Vault resource loading for Studio depends on full vault item responses, not summary-only responses.
