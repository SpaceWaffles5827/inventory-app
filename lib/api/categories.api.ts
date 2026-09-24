// Client-side API helper functions for categories
import type { Category, Item } from "@prisma/client";
import { apiRequest } from "./client";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Category with item count
export type CategoryWithCount = Category & {
  itemCount: number;
  _count?: {
    items: number;
  };
};

// Category with items (for detail view)
// onHand is a derived field (sum of lot-location quantities) added by the API,
// not a stored column on Item.
export type CategoryWithItems = Category & {
  _count: {
    items: number;
  };
  items: (Pick<Item, "id" | "itemNumber" | "name" | "status"> & {
    onHand: number;
  })[];
};

// ============================================
// Request types
// ============================================

export type CreateCategoryRequest = {
  name: string;
  description?: string;
  workspaceId: string;
};

export type UpdateCategoryRequest = {
  name?: string;
  description?: string;
  workspaceId: string;
};

// ============================================
// API Response types
// ============================================

export type ApiResponse<T> = {
  status: "success" | "error";
  message?: string;
  data?: T;
};

export type CategoryApiResponse = ApiResponse<{
  category?: CategoryWithCount | CategoryWithItems;
  categories?: CategoryWithCount[];
}>;

/**
 * Get all categories in a workspace
 */
export async function getCategoriesApi(
  workspaceId: string
): Promise<CategoryApiResponse> {
  return apiRequest<CategoryApiResponse>("/api/categories", {
    query: { workspaceId },
    errorMessage: "Failed to fetch categories",
  });
}

/**
 * Get a single category by ID
 */
export async function getCategoryByIdApi(
  categoryId: string,
  workspaceId: string
): Promise<CategoryApiResponse> {
  return apiRequest<CategoryApiResponse>(`/api/categories/${categoryId}`, {
    query: { workspaceId },
    errorMessage: "Failed to fetch category",
  });
}

/**
 * Create a new category
 */
export async function createCategoryApi(
  data: CreateCategoryRequest
): Promise<CategoryApiResponse> {
  return apiRequest<CategoryApiResponse>("/api/categories", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create category",
  });
}

/**
 * Update an existing category
 */
export async function updateCategoryApi(
  categoryId: string,
  data: UpdateCategoryRequest
): Promise<CategoryApiResponse> {
  return apiRequest<CategoryApiResponse>(`/api/categories/${categoryId}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update category",
  });
}

/**
 * Delete a category
 */
export async function deleteCategoryApi(
  categoryId: string,
  workspaceId: string
): Promise<CategoryApiResponse> {
  return apiRequest<CategoryApiResponse>(`/api/categories/${categoryId}`, {
    method: "DELETE",
    query: { workspaceId },
    errorMessage: "Failed to delete category",
  });
}
