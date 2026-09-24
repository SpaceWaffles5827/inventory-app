// Client-side API helper functions for suppliers
import type { Supplier, Item } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Supplier with item count
export type SupplierWithCount = Supplier & {
  _count: {
    items: number;
  };
};

// Supplier with items (for detail view)
// onHand is a derived field (sum of lot-location quantities) added by the API,
// not a stored column on Item.
export type SupplierWithItems = Supplier & {
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

export type CreateSupplierRequest = {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  workspaceId: string;
};

export type UpdateSupplierRequest = {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  workspaceId: string;
};

// ============================================
// API Response types
// ============================================

export type SupplierApiResponse = ApiResponse<{
  supplier?: SupplierWithCount | SupplierWithItems;
  suppliers?: SupplierWithCount[];
}>;

/**
 * Get all suppliers in a workspace
 */
export async function getSuppliersApi(
  workspaceId: string
): Promise<SupplierApiResponse> {
  return apiRequest<SupplierApiResponse>("/api/suppliers", {
    query: { workspaceId },
    errorMessage: "Failed to fetch suppliers",
  });
}

/**
 * Get a single supplier by ID
 */
export async function getSupplierByIdApi(
  supplierId: string,
  workspaceId: string
): Promise<SupplierApiResponse> {
  return apiRequest<SupplierApiResponse>(`/api/suppliers/${supplierId}`, {
    query: { workspaceId },
    errorMessage: "Failed to fetch supplier",
  });
}

/**
 * Create a new supplier
 */
export async function createSupplierApi(
  data: CreateSupplierRequest
): Promise<SupplierApiResponse> {
  return apiRequest<SupplierApiResponse>("/api/suppliers", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create supplier",
  });
}

/**
 * Update an existing supplier
 */
export async function updateSupplierApi(
  supplierId: string,
  data: UpdateSupplierRequest
): Promise<SupplierApiResponse> {
  return apiRequest<SupplierApiResponse>(`/api/suppliers/${supplierId}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update supplier",
  });
}

/**
 * Delete a supplier
 */
export async function deleteSupplierApi(
  supplierId: string,
  workspaceId: string
): Promise<SupplierApiResponse> {
  return apiRequest<SupplierApiResponse>(`/api/suppliers/${supplierId}`, {
    method: "DELETE",
    query: { workspaceId },
    errorMessage: "Failed to delete supplier",
  });
}
