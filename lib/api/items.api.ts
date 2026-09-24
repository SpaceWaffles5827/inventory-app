// Client-side API helper functions for inventory items
import type { Prisma } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

// ============================================
// Derive types from Prisma queries
// ============================================

// Item with basic relations (for list view)
export type ItemWithRelations = Prisma.ItemGetPayload<{
  include: {
    category: true;
    supplier: true;
    customers: {
      include: {
        customer: true;
      };
    };
    locations: {
      include: {
        location: true;
      };
    };
  };
}> & { onHand: number };

// Item with full details (for detail view)
export type ItemWithDetails = Prisma.ItemGetPayload<{
  include: {
    category: true;
    supplier: true;
    workspace: true;
    customers: {
      include: {
        customer: true;
      };
    };
    locations: {
      include: {
        location: true;
      };
    };
    transactions: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
          };
        };
        fromLocation: {
          select: {
            code: true;
          };
        };
        toLocation: {
          select: {
            code: true;
          };
        };
      };
    };
  };
}> & { onHand: number };

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
  lotTracking?: boolean;
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
  return apiRequest<ItemsApiResponse>("/api/items", {
    query: { workspaceId },
    errorMessage: "Failed to fetch items",
  });
}

/**
 * Get a single item by ID with full details including transactions
 */
export async function getItemByIdApi(id: string): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>(`/api/items/${id}`, {
    errorMessage: "Failed to fetch item",
  });
}

/**
 * Create a new item
 */
export async function createItemApi(
  data: CreateItemRequest
): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>("/api/items", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create item",
  });
}

/**
 * Update an item
 */
export async function updateItemApi(
  id: string,
  data: UpdateItemRequest
): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>(`/api/items/${id}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update item",
  });
}

/**
 * Delete an item
 */
export async function deleteItemApi(id: string): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>(`/api/items/${id}`, {
    method: "DELETE",
    errorMessage: "Failed to delete item",
  });
}

/**
 * Adjust item stock (add or remove quantity)
 */
export async function adjustStockApi(
  id: string,
  data: AdjustStockRequest
): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>(`/api/items/${id}/adjust-stock`, {
    method: "POST",
    body: data,
    errorMessage: "Failed to adjust stock",
  });
}

export type TransferStockRequest = {
  quantity: number;
  fromLocationId: string;
  toLocationId: string;
  /** Required for lot-tracked items; omitted for regular items (the server uses the item's system lot) */
  lotId?: string;
  reason?: string;
};

/**
 * Move stock between two locations
 */
export async function transferStockApi(
  itemId: string,
  data: TransferStockRequest
): Promise<ItemsApiResponse> {
  return apiRequest<ItemsApiResponse>(`/api/items/${itemId}/transfer-stock`, {
    method: "POST",
    body: data,
    errorMessage: "Failed to transfer stock",
  });
}
