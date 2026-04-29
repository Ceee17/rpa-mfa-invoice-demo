# MFA RPA Demo Web App

This workspace contains a demo web app for RPA automation testing.

## Folders

- frontend: Next.js UI (login, MFA, purchase orders)
- backend: Express API with SQLite and seeded purchase orders

## Demo Credentials

- Username: demo
- Password: demo123
- MFA secret (base32): JBSWY3DPEHPK3PXP

## Run the App

### One-command (bash)

```bash
./run.sh
```

This installs dependencies (if needed) and launches both servers.

Note: `run.sh` uses your bash environment (WSL on Windows). Ensure Node.js 18+ in WSL.

### One-command (PowerShell)

```powershell
./run.ps1
```

This uses the Windows Node.js install.

### One-command (Batch)

```bat
run.bat
```

This opens two terminals, one for the backend and one for the frontend.

### 1) Start the backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on http://localhost:4000.

### 2) Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000.

## Docker (Local)

Build and run both services with Docker Compose:

```bash
docker compose up --build
```

Then open:
- http://localhost:3000 (frontend)
- http://localhost:4000 (backend)

## Render Deployment (Free Tier)

Create two Render web services, one for the backend and one for the frontend.

### Backend service

- Root directory: backend
- Dockerfile: backend/Dockerfile
- Environment variables:
	- PORT=4000
	- FRONTEND_ORIGIN=https://<your-frontend-on-render>
- Add a persistent disk mounted at /app/data if you want the SQLite DB to persist.

### Frontend service

- Root directory: frontend
- Dockerfile: frontend/Dockerfile
- Environment variables:
	- NEXT_PUBLIC_API_URL=https://<your-backend-on-render>

## API Notes

- Auth status: GET /api/auth/status
- Login: POST /api/login
- MFA verify: POST /api/mfa/verify
- Purchase orders: GET /api/purchase-orders
- Invoice details: GET /api/invoices/:id
- File downloads: GET /files/:filename

## Environment

To point the frontend at a different backend, set:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
