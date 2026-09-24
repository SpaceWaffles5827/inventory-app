import { Router } from "express";
import multer from "multer";
import itemImagesController from "../controllers/itemImages";

// In-memory uploads, capped. The controller re-checks the bytes with sharp.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 20 },
});
const router = Router();

// --- Multipart upload routes (static paths first) ---
router.post("/multipart/part-url", itemImagesController.getPartUrl);
router.get("/multipart/list", itemImagesController.listParts);
router.post("/multipart/abort", itemImagesController.abortMultipart);

// Get a specific image file
router.get("/image/:imageId", itemImagesController.getItemImage);

// Get all images for an item
router.get("/:itemId", itemImagesController.getItemImages);

// Upload a single image (non-multipart)
router.post("/:itemId", upload.single("image"), itemImagesController.uploadItemImage);

// Set an image as primary
router.patch("/:imageId/primary", itemImagesController.setPrimaryImage);

// Delete an image
router.delete("/:imageId", itemImagesController.deleteItemImage);

// Start / complete multipart upload for an item
router.post("/:itemId/multipart/start", itemImagesController.startMultipart);
router.post("/:itemId/multipart/complete", itemImagesController.completeMultipart);

export default router;
