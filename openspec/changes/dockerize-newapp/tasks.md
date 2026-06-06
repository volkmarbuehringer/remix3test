## 1. Dependency Setup

- [x] 1.1 Change `remix` dependency in `package.json` from GitHub URL to `"remix": "next"`
- [x] 1.2 Run `pnpm install` to update lockfile with npm registry version

## 2. Docker Configuration

- [x] 2.1 Create `Dockerfile` with multi-stage build (builder stage with pnpm install, runtime stage with ca-certificates and app code)
- [x] 2.2 Create `.dockerignore` excluding node_modules, .git, test files, docs, and other non-essentials
- [x] 2.3 Create `docker-compose.yml` for one-command deployment with port mapping and restart policy
- [x] 2.4 Prepare `.env` file with `DATABASE_URL` (Neon) and `SESSION_SECRET`

## 3. Verification

- [ ] 3.1 Build the Docker image: `docker build -t newapp .`
- [ ] 3.2 Run the container: `docker run -d -p 44100:44100 newapp`
- [ ] 3.3 Verify app responds: `curl http://localhost:44100`
- [ ] 3.4 Verify existing user login works against Neon DB
