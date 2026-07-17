-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GENERIC';
ALTER TABLE "Notification" ADD COLUMN "data" JSONB;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "expoPushToken" TEXT,
    "webPushEndpoint" TEXT,
    "webPushSubscription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_expoPushToken_key" ON "PushDevice"("expoPushToken");
CREATE UNIQUE INDEX "PushDevice_webPushEndpoint_key" ON "PushDevice"("webPushEndpoint");
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
