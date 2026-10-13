# 🐳 Build & Publish Docker Image ขึ้น GitHub Packages (GHCR)

คู่มือ build โปรเจกต์ Strapi นี้เป็น Docker image แล้ว push ขึ้น
**GitHub Container Registry → `ghcr.io/kanlayarat/69-s3-app`**

| ไฟล์ | หน้าที่ |
| --- | --- |
| `Dockerfile` | multi-stage build (build → runtime) |
| `.dockerignore` | ตัด `node_modules`, `dist`, `.env` ฯลฯ ออกจาก build context |
| `.github/workflows/docker-publish.yml` | CI อัตโนมัติ: build + push ขึ้น GHCR |
| `package.json` → `build:image:push` | build หลาย platform แล้ว push ขึ้น GHCR |

---

## 1. เตรียมเครื่อง (ทำครั้งเดียว)

1. **เปิด Docker Desktop**
2. **สร้าง builder สำหรับ multi-platform** (default driver ทำ multi-platform ไม่ได้)

   ```powershell
   docker buildx create --name multiarch --driver docker-container --bootstrap --use
   ```

3. **Login GHCR** — สร้าง PAT (classic) ที่ https://github.com/settings/tokens
   scope: `write:packages`, `read:packages`, `repo`

   ```powershell
   $env:CR_PAT="<วาง_TOKEN_ตรงนี้>"
   $env:CR_PAT | docker login ghcr.io -u kanlayarat --password-stdin
   ```

---

## 2. Build + Push (คำสั่งเดียว)

```powershell
npm run build:image:push
```

script นี้เทียบเท่ากับ:

```powershell
docker buildx build `
  --platform linux/amd64,linux/arm64 `
  --provenance=false `
  -t ghcr.io/kanlayarat/69-s3-app:latest `
  --push .
```

> ใช้ `--push` เพราะ image หลาย platform โหลดลงเครื่องด้วย `--load` ไม่ได้
> (`--provenance=false` เพื่อไม่ให้เกิด manifest ย่อยที่ทำให้บาง registry ดึงไม่เจอ)

---

## 3. ทดสอบรัน image

```powershell
docker run --rm -p 1337:1337 --env-file .env `
  -v strapi-data:/app/.tmp `
  -v strapi-uploads:/app/public/uploads `
  ghcr.io/kanlayarat/69-s3-app:latest
```

เปิด http://localhost:1337/admin

---

## 4. ปล่อยผ่าน GitHub Actions อัตโนมัติ (ทางเลือก)

workflow `.github/workflows/docker-publish.yml` จะ build + push ให้ทุกครั้งที่:

- push เข้า branch `main` / `master` → tag `latest`
- push tag เช่น `v1.0.0` → tag `v1.0.0`
- กด *Run workflow* เอง

ไม่ต้องตั้ง secret เพิ่ม เพราะใช้ `GITHUB_TOKEN` (workflow ขอสิทธิ์ `packages: write` ไว้แล้ว)

หลัง push เข้า repo → แท็บ **Packages** → ถ้าจะให้คนอื่น pull ได้
เข้า *Package settings* → เปลี่ยน visibility เป็น **Public**

---

## 5. หมายเหตุสำคัญ

- **Secrets ไม่ถูก bake ลง image** (`.env` ถูก `.dockerignore` ตัดออก)
  ต้องส่งค่าตอนรันด้วย `--env-file .env` เสมอ
- **ค่า env ที่ต้องมี**: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`,
  `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`
- **ฐานข้อมูล**: ค่าเริ่มต้นเป็น SQLite ที่ `/app/.tmp/data.db`
  → mount volume `-v strapi-data:/app/.tmp` ไม่งั้นข้อมูลหายเมื่อลบ container
- **Production จริง** ควรเปลี่ยนไปใช้ Postgres/MySQL ผ่านตัวแปร `DATABASE_*`
- container รันเป็น non-root (`USER node`)
- build arm64 บนเครื่อง amd64 ใช้ QEMU emulation → ช้ากว่าปกติ
