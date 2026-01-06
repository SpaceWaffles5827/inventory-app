import { Router } from "express";
import itemImagesController from "../controllers/itemImages";
import multer from "multer";

const upload = multer();
const router = Router();

// Get all images for an item
router.get("/:itemId", itemImagesController.getItemImages);

// Get a specific image file
router.get("/image/:imageId", itemImagesController.getItemImage);

// Upload a single image (non-multipart)
router.post(
  "/:itemId",
  upload.single("image"),
  itemImagesController.uploadItemImage
);

// Set an image as primary
router.patch("/:imageId/primary", itemImagesController.setPrimaryImage);

// Delete an image
router.delete("/:imageId", itemImagesController.deleteItemImage);

// --- Multipart upload routes ---

// Start multipart upload
router.post("/:itemId/multipart/start", itemImagesController.startMultipart);

// Get presigned URL for part upload
router.post("/multipart/part-url", itemImagesController.getPartUrl);

// Complete multipart upload
router.post(
  "/:itemId/multipart/complete",
  itemImagesController.completeMultipart
);

// List uploaded parts
router.get("/multipart/list", itemImagesController.listParts);

// Abort multipart upload
router.post("/multipart/abort", itemImagesController.abortMultipart);

export default router;
