// Client-side API helper functions for item images
import type { ApiResponse } from "./types";
import { Prisma } from "@prisma/client";

// ============================================
// Derive types from Prisma queries
// ============================================

export const itemImageArgs = Prisma.validator<Prisma.ItemImageDefaultArgs>()({
  include: {
    item: {
      select: {
        id: true,
        name: true,
        itemNumber: true,
      },
    },
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  },
});

export type ItemImageWithRelations = Prisma.ItemImageGetPayload<
  typeof itemImageArgs
>;

// Basic ItemImage without relations
export type ItemImage = {
  id: string;
  itemId: string;
  imageName: string;
  isPrimary: boolean;
  displayOrder: number;
  uploadedAt: string;
  uploadedBy: string;
};

// ============================================
// Request types
// ============================================

export type UploadItemImageRequest = {
  image: File;
  isPrimary?: boolean;
};

export type MultipartUploadStartRequest = {
  mime: string;
};

export type MultipartUploadCompleteRequest = {
  uploadId: string;
  objectKey: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  isPrimary?: boolean;
};

export type MultipartUploadPartRequest = {
  uploadId: string;
  objectKey: string;
  partNumber: number;
};

export type MultipartUploadAbortRequest = {
  uploadId: string;
  objectKey: string;
};

// ============================================
// API Response types
// ============================================

export type ItemImagesApiResponse = ApiResponse<{
  image?: ItemImage | ItemImageWithRelations;
  images?: ItemImage[] | ItemImageWithRelations[];
}>;

export type MultipartStartResponse = {
  uploadId: string;
  objectKey: string;
};

export type MultipartPartUrlResponse = {
  url: string;
};

export type MultipartPartsListResponse = {
  parts: Array<{
    PartNumber: number;
    ETag: string;
    Size: number;
  }>;
};

// ============================================
// API Functions
// ============================================

/**
 * Get all images for an item
 */
export async function getItemImagesApi(
  itemId: string
): Promise<ItemImagesApiResponse> {
  const response = await fetch(`/api/items/images/${itemId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to fetch item images");
  }

  return result;
}

/**
 * Get a specific image file (returns blob URL)
 */
export async function getItemImageFileApi(imageId: string): Promise<string> {
  const response = await fetch(`/api/items/images/image/${imageId}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch image file");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Upload a single item image (for small files)
 */
export async function uploadItemImageApi(
  itemId: string,
  data: UploadItemImageRequest
): Promise<ItemImagesApiResponse> {
  const formData = new FormData();
  formData.append("image", data.image);
  if (data.isPrimary !== undefined) {
    formData.append("isPrimary", String(data.isPrimary));
  }

  const response = await fetch(`/api/items/images/${itemId}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to upload image");
  }

  return result;
}

/**
 * Set an image as primary
 */
export async function setPrimaryImageApi(
  imageId: string
): Promise<ItemImagesApiResponse> {
  const response = await fetch(`/api/items/images/${imageId}/primary`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to set primary image");
  }

  return result;
}

/**
 * Delete an item image
 */
export async function deleteItemImageApi(
  imageId: string
): Promise<ItemImagesApiResponse> {
  const response = await fetch(`/api/items/images/${imageId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to delete image");
  }

  return result;
}

// ============================================
// Multipart Upload Functions (for large files)
// ============================================

/**
 * Start a multipart upload
 */
export async function startMultipartUploadApi(
  itemId: string,
  data: MultipartUploadStartRequest
): Promise<MultipartStartResponse> {
  const response = await fetch(`/api/items/images/${itemId}/multipart/start`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to start multipart upload");
  }

  return result;
}

/**
 * Get presigned URL for uploading a part
 */
export async function getPartUrlApi(
  data: MultipartUploadPartRequest
): Promise<MultipartPartUrlResponse> {
  const response = await fetch(`/api/items/images/multipart/part-url`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to get part URL");
  }

  return result;
}

/**
 * Upload a single part to S3 using presigned URL
 */
export async function uploadPartApi(
  url: string,
  partData: Blob
): Promise<string> {
  const response = await fetch(url, {
    method: "PUT",
    body: partData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload part");
  }

  const etag = response.headers.get("ETag");
  if (!etag) {
    throw new Error("No ETag returned from upload");
  }

  return etag;
}

/**
 * Complete multipart upload
 */
export async function completeMultipartUploadApi(
  itemId: string,
  data: MultipartUploadCompleteRequest
): Promise<ItemImagesApiResponse> {
  const response = await fetch(
    `/api/items/images/${itemId}/multipart/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to complete multipart upload");
  }

  return result;
}

/**
 * List uploaded parts
 */
export async function listPartsApi(
  uploadId: string,
  objectKey: string
): Promise<MultipartPartsListResponse> {
  const params = new URLSearchParams({ uploadId, objectKey });
  const response = await fetch(
    `/api/items/images/multipart/list?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to list parts");
  }

  return result;
}

/**
 * Abort multipart upload
 */
export async function abortMultipartUploadApi(
  data: MultipartUploadAbortRequest
): Promise<{ ok: boolean }> {
  const response = await fetch(`/api/items/images/multipart/abort`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to abort multipart upload");
  }

  return result;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Helper function to upload a large file using multipart upload
 * Automatically handles chunking and part uploads
 */
export async function uploadLargeImageApi(
  itemId: string,
  file: File,
  isPrimary: boolean = false,
  onProgress?: (progress: number) => void
): Promise<ItemImagesApiResponse> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const mime = file.type;

  // Start multipart upload
  const { uploadId, objectKey } = await startMultipartUploadApi(itemId, {
    mime,
  });

  try {
    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    // Upload each part
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      // Get presigned URL for this part
      const { url } = await getPartUrlApi({
        uploadId,
        objectKey,
        partNumber,
      });

      // Upload the part
      const etag = await uploadPartApi(url, chunk);
      parts.push({ ETag: etag, PartNumber: partNumber });

      // Report progress
      if (onProgress) {
        const progress = Math.round(((i + 1) / totalParts) * 100);
        onProgress(progress);
      }
    }

    // Complete the upload
    return await completeMultipartUploadApi(itemId, {
      uploadId,
      objectKey,
      parts,
      isPrimary,
    });
  } catch (error) {
    // Abort upload on error
    await abortMultipartUploadApi({ uploadId, objectKey });
    throw error;
  }
}

/**
 * Smart upload function that chooses single or multipart upload based on file size
 */
export async function smartUploadImageApi(
  itemId: string,
  file: File,
  isPrimary: boolean = false,
  onProgress?: (progress: number) => void
): Promise<ItemImagesApiResponse> {
  const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB

  if (file.size > MULTIPART_THRESHOLD) {
    // Use multipart upload for large files
    return uploadLargeImageApi(itemId, file, isPrimary, onProgress);
  } else {
    // Use simple upload for small files
    const result = await uploadItemImageApi(itemId, { image: file, isPrimary });
    if (onProgress) {
      onProgress(100);
    }
    return result;
  }
}
