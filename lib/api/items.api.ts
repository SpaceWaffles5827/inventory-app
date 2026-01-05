// Client-side API helper functions for inventory items
import type { ApiResponse } from "./types";
import { Prisma } from "@prisma/client";

// ============================================
// Derive types from Prisma queries
// ============================================

// Item with basic relations (for list view)
export const itemWithRelationsArgs = Prisma.validator<Prisma.ItemDefaultArgs>()(
  {
    include: {
      category: true,
      supplier: true,
      customers: {
        include: {
          customer: true,
        },
      },
      locations: {
        include: {
          location: true,
        },
      },
    },
  }
);

// Item with full details (for detail view)
export const itemWithDetailsArgs = Prisma.validator<Prisma.ItemDefaultArgs>()({
  include: {
    category: true,
    supplier: true,
    workspace: true,
    customers: {
      include: {
        customer: true,
      },
    },
    locations: {
      include: {
        location: true,
      },
    },
    transactions: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  },
});

export type ItemWithRelations = Prisma.ItemGetPayload<
  typeof itemWithRelationsArgs
> & { onHand: number };

export type ItemWithDetails = Prisma.ItemGetPayload<
  typeof itemWithDetailsArgs
> & { onHand: number };

// ============================================
// Request types
// ============================================

export type CreateItemRequest = {
  workspaceId: string;
  name: string;
  barcode?: string;
  unit?: string;
  description?: string;
  onHand?: number;
  cost?: number;
  categoryId?: string;
  locationId?: string;
  locationIds?: string[];
  supplierId?: string;
  customerIds?: string[];
};

export type UpdateItemRequest = {
  itemNumber?: string;
  name?: string;
  barcode?: string;
  unit?: string;
  description?: string;
  cost?: number;
  categoryId?: string;
  locationId?: string;
  locationIds?: string[];
  supplierId?: string;
  customerIds?: string[];
};

export type AdjustStockRequest = {
  type: "INPUT" | "OUTPUT";
  quantity: number;
  reason: string;
  locationId?: string;
};

// ============================================
// API Response types
// ============================================

export type ItemsApiResponse = ApiResponse<{
  item?: ItemWithRelations | ItemWithDetails;
  items?: ItemWithRelations[];
}>;

/**
 * Get all items in a workspace
 */
export async function getItemsApi(
  workspaceId: string
): Promise<ItemsApiResponse> {
  const response = await fetch(`/api/items?workspaceId=${workspaceId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch items");
  }

  return result;
}

/**
 * Get a single item by ID with full details including transactions
 */
export async function getItemByIdApi(id: string): Promise<ItemsApiResponse> {
  const response = await fetch(`/api/items/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch item");
  }

  return result;
}

/**
 * Create a new item
 */
export async function createItemApi(
  data: CreateItemRequest
): Promise<ItemsApiResponse> {
  const response = await fetch("/api/items", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create item");
  }

  return result;
}

/**
 * Update an item
 */
export async function updateItemApi(
  id: string,
  data: UpdateItemRequest
): Promise<ItemsApiResponse> {
  const response = await fetch(`/api/items/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update item");
  }

  return result;
}

/**
 * Delete an item
 */
export async function deleteItemApi(id: string): Promise<ItemsApiResponse> {
  const response = await fetch(`/api/items/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to delete item");
  }

  return result;
}

/**
 * Adjust item stock (add or remove quantity)
 */
export async function adjustStockApi(
  id: string,
  data: AdjustStockRequest
): Promise<ItemsApiResponse> {
  const response = await fetch(`/api/items/${id}/adjust-stock`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to adjust stock");
  }

  return result;
}
