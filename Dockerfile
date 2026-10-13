# syntax=docker/dockerfile:1

########################################
# Stage 1 — Build (ติดตั้ง deps + build)
########################################
FROM node:22-bookworm-slim AS build

# เครื่องมือสำหรับ compile native module เช่น better-sqlite3 ตอน `npm ci`
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# คัดลอก manifest ก่อน เพื่อใช้ Docker layer cache (ไม่ต้อง npm ci ใหม่ทุกครั้งที่แก้โค้ด)
COPY package.json package-lock.json ./
RUN npm ci

# คัดลอกซอร์สทั้งหมด แล้ว build admin panel + server
COPY . .

# build แบบ production แล้วตัด devDependencies ทิ้งเพื่อให้ image เล็กลง
ENV NODE_ENV=production
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

########################################
# Stage 2 — Runtime (image จริงที่รัน)
########################################
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337

WORKDIR /app

# คัดลอกแอป + node_modules (production) ที่ build แล้วจาก stage ก่อน
COPY --from=build /app ./

# เตรียมโฟลเดอร์ที่ต้องเขียนตอนรัน (sqlite / uploads) ให้ user node เขียนได้
RUN mkdir -p /app/.tmp /app/public/uploads \
    && chown -R node:node /app

USER node

EXPOSE 1337

# หมายเหตุ: ต้องส่งค่า env (APP_KEYS, *_SALT, *_SECRET, ENCRYPTION_KEY) ตอนรัน
# ตัวอย่าง: docker run --env-file .env -p 1337:1337 ghcr.io/USER/REPO:latest
CMD ["npm", "run", "start"]
