import { Router } from "express";
import { size as queueSize } from "../matchmaking/queue.js";
import { getAllRooms } from "../ws/rooms.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    queue: queueSize(),
    activeSessions: getAllRooms().size,
  });
});

export default router;
