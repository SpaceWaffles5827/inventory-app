import { Request, Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma";
import sharp from "sharp";
import crypto from "crypto";

const BUCKET = process.env.BUCKET_NAME!;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

if (
  !process.env.BUCKET_REGION ||
  !process.env.MINIO_ROOT_USER ||
  !process.env.MINIO_ROOT_PASSWORD
) {
  throw new Error("Environment variables for S3 are missing.");
}

const s3Client = new S3Client({
  region: process.env.BUCKET_REGION,
  endpoint: process.env.MINIO_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
  },
});

function randomKey(ext: string) {
  return `item-images/${crypto.randomUUID()}.${ext}`;
}

const itemImagesController = {
  // Upload a single item image
  uploadItemImage: async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const { itemId } = req.params;
      const userId = req.user?.id;
      const { isPrimary } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { buffer, mimetype } = req.file;

      if (!ALLOWED_MIME_TYPES.has(mimetype)) {
        return res.status(400).json({
          error: "Invalid file type. Only image files are allowed.",
        });
      }

      // Verify item exists and user has access
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { workspaceId: true },
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      // Verify user has access to workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          error: "You don't have permission to upload images for this item",
        });
      }

      // Convert image to JPEG
      const imageId = uuidv4();
      let processedBuffer: Buffer;

      try {
        processedBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      } catch (err) {
        console.error("Error processing image:", err);
        return res.status(500).json({ error: "Error processing the image." });
      }

      // Upload to S3
      const imageName = `${imageId}.jpeg`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Body: processedBuffer,
          Key: `item-images/${imageName}`,
          ContentType: "image/jpeg",
        })
      );

      // If this is set as primary, unset other primary images
      if (isPrimary === "true" || isPrimary === true) {
        await prisma.itemImage.updateMany({
          where: {
            itemId: itemId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Get the highest display order
      const lastImage = await prisma.itemImage.findFirst({
        where: { itemId: itemId },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });

      const displayOrder = lastImage ? lastImage.displayOrder + 1 : 0;

      // Create database record
      const itemImage = await prisma.itemImage.create({
        data: {
          itemId: itemId,
          imageName: imageName,
          isPrimary: isPrimary === "true" || isPrimary === true,
          displayOrder: displayOrder,
          uploadedBy: userId,
        },
      });

      return res.status(200).json({
        message: "Image uploaded successfully",
        data: { image: itemImage },
      });
    } catch (error) {
      console.error("Upload item image error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get all images for an item
  getItemImages: async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify item exists and user has access
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { workspaceId: true },
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      // Verify user has access to workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          error: "You don't have access to this item",
        });
      }

      const images = await prisma.itemImage.findMany({
        where: { itemId: itemId },
        orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
      });

      return res.status(200).json({
        status: "success",
        data: { images },
      });
    } catch (error) {
      console.error("Get item images error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get a single item image
  getItemImage: async (
    req: Request,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { imageId } = req.params;

      // Fetch image from database
      const itemImage = await prisma.itemImage.findUnique({
        where: { id: imageId },
        select: { imageName: true, itemId: true },
      });

      if (!itemImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Download from S3
      const downloadParams = {
        Bucket: BUCKET,
        Key: `item-images/${itemImage.imageName}`,
      };

      const data = await s3Client.send(new GetObjectCommand(downloadParams));
      if (!data.Body) {
        return res.status(404).json({ error: "File not found in S3." });
      }

      res.set("Content-Type", "image/jpeg");

      const body = data.Body as { pipe?: (destination: Response) => void };
      if (typeof body.pipe === "function") {
        return body.pipe(res);
      } else {
        return res.send(body);
      }
    } catch (error) {
      console.error("Get item image error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Delete an item image
  deleteItemImage: async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get image and verify access
      const itemImage = await prisma.itemImage.findUnique({
        where: { id: imageId },
        include: {
          item: {
            select: { workspaceId: true },
          },
        },
      });

      if (!itemImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Verify user has access to workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: itemImage.item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          error: "You don't have permission to delete this image",
        });
      }

      // Delete from S3
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: `item-images/${itemImage.imageName}`,
        })
      );

      // Delete from database
      await prisma.itemImage.delete({
        where: { id: imageId },
      });

      return res.status(200).json({
        message: "Image deleted successfully",
      });
    } catch (error) {
      console.error("Delete item image error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Set primary image
  setPrimaryImage: async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get image and verify access
      const itemImage = await prisma.itemImage.findUnique({
        where: { id: imageId },
        include: {
          item: {
            select: { workspaceId: true },
          },
        },
      });

      if (!itemImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Verify user has access to workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: itemImage.item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          error: "You don't have permission to update this image",
        });
      }

      // Unset other primary images for this item
      await prisma.itemImage.updateMany({
        where: {
          itemId: itemImage.itemId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      // Set this image as primary
      const updatedImage = await prisma.itemImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });

      return res.status(200).json({
        message: "Primary image updated successfully",
        data: { image: updatedImage },
      });
    } catch (error) {
      console.error("Set primary image error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Start multipart upload
  startMultipart: async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { mime } = req.body as { mime: string };
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!ALLOWED_MIME_TYPES.has(mime)) {
        return res.status(400).json({ error: "Unsupported mime type" });
      }

      // Verify item exists and user has access
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: { workspaceId: true },
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      // Verify user has access to workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          error: "You don't have permission to upload images for this item",
        });
      }

      const ext = "jpg";
      const objectKey = randomKey(ext);

      const create = await s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: BUCKET,
          Key: objectKey,
          ContentType: "image/jpeg",
        })
      );

      const uploadId = create.UploadId!;
      return res.json({ uploadId, objectKey });
    } catch (error) {
      console.error("Start multipart error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Complete multipart upload
  completeMultipart: async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { uploadId, objectKey, parts, isPrimary } = req.body as {
        uploadId: string;
        objectKey: string;
        parts: { ETag: string; PartNumber: number }[];
        isPrimary?: boolean;
      };
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Finalize the multipart upload in S3
      await s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: BUCKET,
          Key: objectKey,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
          },
        })
      );

      // If this is set as primary, unset other primary images
      if (isPrimary) {
        await prisma.itemImage.updateMany({
          where: {
            itemId: itemId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Get the highest display order
      const lastImage = await prisma.itemImage.findFirst({
        where: { itemId: itemId },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });

      const displayOrder = lastImage ? lastImage.displayOrder + 1 : 0;

      // Extract filename from objectKey
      const fileName = objectKey.includes("/")
        ? objectKey.substring(objectKey.lastIndexOf("/") + 1)
        : objectKey;

      // Create database record
      const itemImage = await prisma.itemImage.create({
        data: {
          itemId: itemId,
          imageName: fileName,
          isPrimary: isPrimary || false,
          displayOrder: displayOrder,
          uploadedBy: userId,
        },
      });

      return res.json({
        ok: true,
        data: { image: itemImage },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return res.status(404).json({ error: "Item not found" });
      }
      console.error("Complete multipart error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Get presigned URL for part upload
  getPartUrl: async (req: Request, res: Response) => {
    try {
      const { uploadId, objectKey, partNumber } = req.body as {
        uploadId: string;
        objectKey: string;
        partNumber: number;
      };

      const command = new UploadPartCommand({
        Bucket: BUCKET,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return res.json({ url });
    } catch (error) {
      console.error("Get part URL error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // List parts
  listParts: async (req: Request, res: Response) => {
    try {
      const { uploadId, objectKey } = req.query as {
        uploadId: string;
        objectKey: string;
      };
      const out = await s3Client.send(
        new ListPartsCommand({
          Bucket: BUCKET,
          Key: objectKey,
          UploadId: uploadId,
        })
      );
      const parts = (out.Parts || []).map((p) => ({
        PartNumber: p.PartNumber!,
        ETag: p.ETag!,
        Size: p.Size || 0,
      }));
      return res.json({ parts });
    } catch (error) {
      console.error("List parts error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  // Abort multipart upload
  abortMultipart: async (req: Request, res: Response) => {
    try {
      const { uploadId, objectKey } = req.body as {
        uploadId: string;
        objectKey: string;
      };

      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: BUCKET,
          Key: objectKey,
          UploadId: uploadId,
        })
      );

      return res.json({ ok: true });
    } catch (error) {
      console.error("Abort multipart error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
};

export default itemImagesController;
