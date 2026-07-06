import { Express, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

function randomSuffix() {
  return Math.random().toString(36).substring(2, 8);
}

export function registerUploadRoutes(app: Express) {
  app.post(
    "/api/upload/meal-photo",
    upload.single("photo"),
    async (req: Request, res: Response) => {
      try {
        // Verify session
        const user = await sdk.authenticateRequest(req).catch(() => null);
        if (!user) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }

        const ext =
          req.file.mimetype === "image/png"
            ? "png"
            : req.file.mimetype === "image/webp"
            ? "webp"
            : "jpg";
        const key = `meal-photos/${user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
        const result = await storagePut(key, req.file.buffer, req.file.mimetype);

        res.json({ photoUrl: result.url, photoKey: key });
      } catch (err: any) {
        console.error("[upload-meal-photo] error:", err?.message ?? err);
        res.status(500).json({ error: err?.message ?? "Upload failed" });
      }
    }
  );
}
