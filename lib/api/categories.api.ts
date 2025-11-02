// Client-side API helper functions for categories
import type { Category, Item, Prisma } from "@prisma/client";

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
export type CategoryWithItems = Category & {
  _count: {
    items: number;
  };
  items: Pick<Item, "id" | "itemNumber" | "name" | "onHand" | "status">[];
};

// Or use Prisma's built-in payload type
export type CategoryWithItemsAlt = Prisma.CategoryGetPayload<{
  include: {
    _count: { select: { items: true } };
    items: {
      select: {
        id: true;
        itemNumber: true;
        name: true;
        onHand: true;
        status: true;
      };
    };
  };
}>;

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
  const response = await fetch(
    `/api/categories?workspaceId=${encodeURIComponent(workspaceId)}`,
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
    throw new Error(result.message || "Failed to fetch categories");
  }

  return result;
}

/**
 * Get a single category by ID
 */
export async function getCategoryByIdApi(
  categoryId: string,
  workspaceId: string
): Promise<CategoryApiResponse> {
  const response = await fetch(
    `/api/categories/${categoryId}?workspaceId=${encodeURIComponent(
      workspaceId
    )}`,
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
    throw new Error(result.message || "Failed to fetch category");
  }

  return result;
}

/**
 * Create a new category
 */
export async function createCategoryApi(
  data: CreateCategoryRequest
): Promise<CategoryApiResponse> {
  const response = await fetch("/api/categories", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create category");
  }

  return result;
}

/**
 * Update an existing category
 */
export async function updateCategoryApi(
  categoryId: string,
  data: UpdateCategoryRequest
): Promise<CategoryApiResponse> {
  const response = await fetch(`/api/categories/${categoryId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update category");
  }

  return result;
}

/**
 * Delete a category
 */
export async function deleteCategoryApi(
  categoryId: string,
  workspaceId: string
): Promise<CategoryApiResponse> {
  const response = await fetch(
    `/api/categories/${categoryId}?workspaceId=${encodeURIComponent(
      workspaceId
    )}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to delete category");
  }

  return result;
}
