# 🐳 Build & Publish Docker Image ขึ้น GitHub Packages (GHCR)

คู่มือ build โปรเจกต์ Strapi นี้เป็น Docker image แล้ว push ขึ้น
**GitHub Container Registry → `ghcr.io/kanlayarat-y-coder/69-s3-app`**

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

3. **Login GHCR** (สำหรับ push จากเครื่องเองเท่านั้น) — สร้าง PAT (classic) ของบัญชี
   **`kanlayarat-y-coder`** ที่ https://github.com/settings/tokens
   scope: `write:packages`, `read:packages`

   ```powershell
   $env:CR_PAT="<วาง_TOKEN_ตรงนี้>"
   $env:CR_PAT | docker login ghcr.io -u kanlayarat-y-coder --password-stdin
   ```

   > CI (GitHub Actions) **ไม่ต้องใช้ PAT** เพราะ push เข้า namespace เจ้าของ repo
   > ใช้ `GITHUB_TOKEN` อัตโนมัติได้เลย

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
  -t ghcr.io/kanlayarat-y-coder/69-s3-app:latest `
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
  ghcr.io/kanlayarat-y-coder/69-s3-app:latest
```

เปิด http://localhost:1337/admin

---

## 4. ปล่อยผ่าน GitHub Actions อัตโนมัติ (ทางเลือก)

workflow `.github/workflows/docker-publish.yml` จะ build + push ให้ทุกครั้งที่:

- push เข้า branch `main` / `master` / `develop` → tag `latest` (default branch) + tag ชื่อ branch
- push tag เช่น `v1.0.0` → tag `v1.0.0`
- กด *Run workflow* เอง

### ไม่ต้องตั้ง secret

ปลายทาง `ghcr.io/kanlayarat-y-coder/69-s3-app` อยู่ namespace เดียวกับเจ้าของ repo
→ workflow ใช้ `GITHUB_TOKEN` (สิทธิ์ `packages: write` ที่ตั้งไว้ใน workflow) push ได้เลย
ไม่ต้องสร้าง PAT หรือ secret ใด ๆ เพิ่ม

หลัง push เข้า repo → แท็บ **Packages** → ถ้าจะให้คนอื่น pull ได้
เข้า *Package settings* → เปลี่ยน visibility เป็น **Public**

### แก้ปัญหา push ขึ้น GHCR ไม่ผ่าน

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| `denied: permission_denied` | token ที่ใช้ไม่มีสิทธิ์ใน namespace ปลายทาง → ตรวจว่า `IMAGE_NAME` เป็น `kanlayarat-y-coder/69-s3-app` และ workflow มี `permissions: packages: write` |
| push จากเครื่องไม่ผ่าน | ต้อง `docker login ghcr.io -u kanlayarat-y-coder` ด้วย **classic PAT** scope `write:packages` (fine-grained ใช้กับ Packages ไม่ได้) |
| ขึ้น `unauthorized` | PAT หมดอายุ/พิมพ์ผิด หรือ login คนละบัญชีกับเจ้าของ namespace |

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
