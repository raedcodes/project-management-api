-- CreateIndex
CREATE INDEX `Task_userId_createdAt_idx` ON `Task`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Task_userId_dueDate_idx` ON `Task`(`userId`, `dueDate`);
