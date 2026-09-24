// Item images stored in S3/MinIO.
//
// New objects live under a tenant prefix:
//   item-images/ws/<workspaceId>/<itemId>/<uuid>.jpg
// and ItemImage.imageName stores the part after "item-images/" (older rows
// hold a bare "<uuid>.jpeg", which still resolves). Multipart endpoints that
// receive an objectKey from the client parse it, and only accept keys inside
// the prefix of an item the caller can access.
//
// Responses use { status, message, data }. For compatibility, error bodies
// also carry `error`, and the multipart endpoints keep their old top-level
// fields (uploadId, objectKey, url, parts, ok).
import { Request, Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, loadItemForUser, requireMembership, requireUserId } from "../utils/access";
import { HttpError, badRequest, notFound, sendSuccess } from "../utils/http";
import { parseBody, parseQuery, zBooleanish } from "../utils/validate";
import logger from "../utils/logger";

const BUCKET = process.env.BUCKET_NAME!;
const PREFIX = "item-images/";
const MAX_MULTIPART_BYTES = 25 * 1024 * 1024;
const MAX_PARTS = 100;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "gif", "webp"]);

if (!process.env.BUCKET_REGION || !process.env.MINIO_ROOT_USER || !process.env.MINIO_ROOT_PASSWORD) {
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

// ---------------------------------------------------------------------------
// Key scoping
// ---------------------------------------------------------------------------

const KEY_PATTERN =
  /^item-images\/ws\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64})\/([0-9a-f-]{36})\.jpg$/;

const newObjectKey = (workspaceId: string, itemId: string) =>
  `${PREFIX}ws/${workspaceId}/${itemId}/${crypto.randomUUID()}.jpg`;

/**
 * Validate a client-supplied object key and the caller's access to it.
 * Returns the item the key belongs to.
 */
async function authorizeObjectKey(userId: string, objectKey: string, expectItemId?: string) {
  const m = KEY_PATTERN.exec(objectKey);
  if (!m) throw badRequest("Invalid object key");
  const [, workspaceId, itemId] = m;
  if (expectItemId && expectItemId !== itemId) throw badRequest("Object key does not belong to this item");

  const item = await prisma.item.findFirst({
    where: { id: itemId, workspaceId },
    select: { id: true, workspaceId: true },
  });
  if (!item) throw notFound("Item not found");
  await requireMembership(userId, workspaceId, PERMISSIONS.edit, {
    message: "You don't have permission to upload images for this item",
  });
  return item;
}

/** Only JPEG / PNG / GIF / WebP, judged by the bytes (not the declared mimetype). */
function sniffImage(head: Buffer): boolean {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (head.length >= 6 && /^GIF8[79]a$/.test(head.subarray(0, 6).toString("ascii"))) return true;
  if (head.length >= 12 && head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return true;
  return false;
}

async function nextDisplayOrder(itemId: string) {
  const last = await prisma.itemImage.findFirst({
    where: { itemId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  return last ? last.displayOrder + 1 : 0;
}

/** Create the DB row (making it primary if asked) atomically. */
async function createImageRecord(itemId: string, imageName: string, isPrimary: boolean, userId: string) {
  const displayOrder = await nextDisplayOrder(itemId);
  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.itemImage.updateMany({ where: { itemId, isPrimary: true }, data: { isPrimary: false } });
    }
    return tx.itemImage.create({
      data: { itemId, imageName, isPrimary, displayOrder, uploadedBy: userId },
    });
  });
}

async function loadImageForUser(userId: string, imageId: string, minRole: "MEMBER" | "ADMIN", message?: string) {
  const image = await prisma.itemImage.findUnique({
    where: { id: imageId },
    include: { item: { select: { workspaceId: true } } },
  });
  if (!image) throw notFound("Image not found");
  await requireMembership(userId, image.item.workspaceId, minRole, { message });
  return image;
}

const multipartKeySchema = z.object({
  uploadId: z.string().min(1).max(1024),
  objectKey: z.string().min(1).max(512),
});

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

const itemImagesController = {
  // POST /api/items/images/:itemId (multipart/form-data, field "image")
  uploadItemImage: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    if (!req.file) throw badRequest("No file uploaded.");
    const { isPrimary } = parseBody(z.object({ isPrimary: zBooleanish.optional() }), req);

    const { item } = await loadItemForUser(
      userId,
      req.params.itemId,
      PERMISSIONS.edit,
      "You don't have permission to upload images for this item"
    );

    if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
      throw badRequest("Invalid file type. Only image files are allowed.");
    }

    // Trust the bytes, not the declared mimetype.
    let processed: Buffer;
    try {
      const meta = await sharp(req.file.buffer).metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
        throw badRequest("Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.");
      }
      processed = await sharp(req.file.buffer).rotate().jpeg({ quality: 90 }).toBuffer();
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw badRequest("The uploaded file is not a valid image.");
    }

    const key = newObjectKey(item.workspaceId, item.id);
    await s3Client.send(
      new PutObjectCommand({ Bucket: BUCKET, Body: processed, Key: key, ContentType: "image/jpeg" })
    );

    const image = await createImageRecord(item.id, key.slice(PREFIX.length), !!isPrimary, userId);
    return sendSuccess(res, { image }, "Image uploaded successfully");
  },

  // GET /api/items/images/:itemId
  getItemImages: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { item } = await loadItemForUser(userId, req.params.itemId);
    const images = await prisma.itemImage.findMany({
      where: { itemId: item.id },
      orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
    });
    return sendSuccess(res, { images });
  },

  // GET /api/items/images/image/:imageId — the image bytes
  getItemImage: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const image = await loadImageForUser(userId, req.params.imageId, "MEMBER");

    const data = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}${image.imageName}` })
    );
    if (!data.Body) throw notFound("File not found in storage.");

    res.set("Content-Type", data.ContentType?.startsWith("image/") ? data.ContentType : "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    const body = data.Body as { pipe?: (destination: Response) => void };
    if (typeof body.pipe === "function") return body.pipe(res);
    return res.send(await data.Body.transformToByteArray());
  },

  // DELETE /api/items/images/:imageId (ADMIN+)
  deleteItemImage: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const image = await loadImageForUser(
      userId,
      req.params.imageId,
      PERMISSIONS.delete,
      "You don't have permission to delete this image"
    );

    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}${image.imageName}` }));
    await prisma.itemImage.delete({ where: { id: image.id } });
    return sendSuccess(res, {}, "Image deleted successfully");
  },

  // PATCH /api/items/images/:imageId/primary
  setPrimaryImage: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const image = await loadImageForUser(
      userId,
      req.params.imageId,
      PERMISSIONS.edit,
      "You don't have permission to update this image"
    );

    const updated = await prisma.$transaction(async (tx) => {
      await tx.itemImage.updateMany({
        where: { itemId: image.itemId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.itemImage.update({ where: { id: image.id }, data: { isPrimary: true } });
    });
    return sendSuccess(res, { image: updated }, "Primary image updated successfully");
  },

  // POST /api/items/images/:itemId/multipart/start  { mime }
  startMultipart: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { mime } = parseBody(z.object({ mime: z.string().max(100) }), req);
    if (!ALLOWED_MIME_TYPES.has(mime)) throw badRequest("Unsupported mime type");

    const { item } = await loadItemForUser(
      userId,
      req.params.itemId,
      PERMISSIONS.edit,
      "You don't have permission to upload images for this item"
    );

    const objectKey = newObjectKey(item.workspaceId, item.id);
    const created = await s3Client.send(
      new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: objectKey, ContentType: mime })
    );
    const uploadId = created.UploadId!;
    return res.json({ status: "success", data: { uploadId, objectKey }, uploadId, objectKey });
  },

  // POST /api/items/images/multipart/part-url  { uploadId, objectKey, partNumber }
  getPartUrl: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      multipartKeySchema.extend({
        partNumber: z.preprocess(
          (v) => (typeof v === "string" ? Number(v) : v),
          z.number().int().min(1).max(MAX_PARTS)
        ),
      }),
      req
    );
    await authorizeObjectKey(userId, body.objectKey);

    const url = await getSignedUrl(
      s3Client,
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: body.objectKey,
        UploadId: body.uploadId,
        PartNumber: body.partNumber,
      }),
      { expiresIn: 900 }
    );
    return res.json({ status: "success", data: { url }, url });
  },

  // POST /api/items/images/:itemId/multipart/complete  { uploadId, objectKey, parts, isPrimary? }
  completeMultipart: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      multipartKeySchema.extend({
        parts: z
          .array(z.object({ ETag: z.string().min(1).max(256), PartNumber: z.number().int().min(1).max(MAX_PARTS) }))
          .min(1)
          .max(MAX_PARTS),
        isPrimary: zBooleanish.optional(),
      }),
      req
    );
    const item = await authorizeObjectKey(userId, body.objectKey, req.params.itemId);

    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: body.objectKey,
        UploadId: body.uploadId,
        MultipartUpload: {
          Parts: [...body.parts].sort((a, b) => a.PartNumber - b.PartNumber),
        },
      })
    );

    // The bytes went straight to storage: check size and that it is an image.
    const reject = async (message: string) => {
      await s3Client
        .send(new DeleteObjectCommand({ Bucket: BUCKET, Key: body.objectKey }))
        .catch((e) => logger.warn("failed to delete rejected upload", { error: String(e) }));
      throw badRequest(message);
    };
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: body.objectKey }));
    if ((head.ContentLength ?? 0) > MAX_MULTIPART_BYTES) {
      await reject(`Image too large (max ${MAX_MULTIPART_BYTES / 1024 / 1024} MB)`);
    }
    const first = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: body.objectKey, Range: "bytes=0-31" })
    );
    const bytes = first.Body ? Buffer.from(await first.Body.transformToByteArray()) : Buffer.alloc(0);
    if (!sniffImage(bytes)) await reject("The uploaded file is not a valid image.");

    const image = await createImageRecord(
      item.id,
      body.objectKey.slice(PREFIX.length),
      !!body.isPrimary,
      userId
    );
    return res.json({ status: "success", data: { image }, ok: true });
  },

  // GET /api/items/images/multipart/list?uploadId=&objectKey=
  listParts: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(multipartKeySchema, req);
    await authorizeObjectKey(userId, q.objectKey);

    const out = await s3Client.send(
      new ListPartsCommand({ Bucket: BUCKET, Key: q.objectKey, UploadId: q.uploadId })
    );
    const parts = (out.Parts || []).map((p) => ({
      PartNumber: p.PartNumber!,
      ETag: p.ETag!,
      Size: p.Size || 0,
    }));
    return res.json({ status: "success", data: { parts }, parts });
  },

  // POST /api/items/images/multipart/abort  { uploadId, objectKey }
  abortMultipart: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(multipartKeySchema, req);
    await authorizeObjectKey(userId, body.objectKey);

    await s3Client.send(
      new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: body.objectKey, UploadId: body.uploadId })
    );
    return res.json({ status: "success", data: {}, ok: true });
  },
};

export default itemImagesController;
