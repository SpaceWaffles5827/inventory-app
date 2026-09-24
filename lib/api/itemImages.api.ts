// Client-side API helper functions for item images
import type { Prisma } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

// ============================================
// Derive types from Prisma queries
// ============================================

export type ItemImageWithRelations = Prisma.ItemImageGetPayload<{
  include: {
    item: {
      select: {
        id: true;
        name: true;
        itemNumber: true;
      };
    };
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

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
  return apiRequest<ItemImagesApiResponse>(`/api/items/images/${itemId}`, {
    errorMessage: "Failed to fetch item images",
  });
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

  return apiRequest<ItemImagesApiResponse>(`/api/items/images/${itemId}`, {
    method: "POST",
    body: formData,
    errorMessage: "Failed to upload image",
  });
}

/**
 * Set an image as primary
 */
export async function setPrimaryImageApi(
  imageId: string
): Promise<ItemImagesApiResponse> {
  return apiRequest<ItemImagesApiResponse>(
    `/api/items/images/${imageId}/primary`,
    {
      method: "PATCH",
      errorMessage: "Failed to set primary image",
    }
  );
}

/**
 * Delete an item image
 */
export async function deleteItemImageApi(
  imageId: string
): Promise<ItemImagesApiResponse> {
  return apiRequest<ItemImagesApiResponse>(`/api/items/images/${imageId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete image",
  });
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
  return apiRequest<MultipartStartResponse>(
    `/api/items/images/${itemId}/multipart/start`,
    {
      method: "POST",
      body: data,
      errorMessage: "Failed to start multipart upload",
    }
  );
}

/**
 * Get presigned URL for uploading a part
 */
export async function getPartUrlApi(
  data: MultipartUploadPartRequest
): Promise<MultipartPartUrlResponse> {
  return apiRequest<MultipartPartUrlResponse>(
    "/api/items/images/multipart/part-url",
    {
      method: "POST",
      body: data,
      errorMessage: "Failed to get part URL",
    }
  );
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
  return apiRequest<ItemImagesApiResponse>(
    `/api/items/images/${itemId}/multipart/complete`,
    {
      method: "POST",
      body: data,
      errorMessage: "Failed to complete multipart upload",
    }
  );
}

/**
 * List uploaded parts
 */
export async function listPartsApi(
  uploadId: string,
  objectKey: string
): Promise<MultipartPartsListResponse> {
  return apiRequest<MultipartPartsListResponse>(
    "/api/items/images/multipart/list",
    {
      query: { uploadId, objectKey },
      errorMessage: "Failed to list parts",
    }
  );
}

/**
 * Abort multipart upload
 */
export async function abortMultipartUploadApi(
  data: MultipartUploadAbortRequest
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/api/items/images/multipart/abort", {
    method: "POST",
    body: data,
    errorMessage: "Failed to abort multipart upload",
  });
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
