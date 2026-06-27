// Client-side API helper functions for suppliers
import type { Supplier, Item } from "@prisma/client";
import type { ApiResponse } from "./types";

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
  const response = await fetch(
    `/api/suppliers?workspaceId=${encodeURIComponent(workspaceId)}`,
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
    throw new Error(result.message || "Failed to fetch suppliers");
  }

  return result;
}

/**
 * Get a single supplier by ID
 */
export async function getSupplierByIdApi(
  supplierId: string,
  workspaceId: string
): Promise<SupplierApiResponse> {
  const response = await fetch(
    `/api/suppliers/${supplierId}?workspaceId=${encodeURIComponent(
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
    throw new Error(result.message || "Failed to fetch supplier");
  }

  return result;
}

/**
 * Create a new supplier
 */
export async function createSupplierApi(
  data: CreateSupplierRequest
): Promise<SupplierApiResponse> {
  const response = await fetch("/api/suppliers", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create supplier");
  }

  return result;
}

/**
 * Update an existing supplier
 */
export async function updateSupplierApi(
  supplierId: string,
  data: UpdateSupplierRequest
): Promise<SupplierApiResponse> {
  const response = await fetch(`/api/suppliers/${supplierId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update supplier");
  }

  return result;
}

/**
 * Delete a supplier
 */
export async function deleteSupplierApi(
  supplierId: string,
  workspaceId: string
): Promise<SupplierApiResponse> {
  const response = await fetch(
    `/api/suppliers/${supplierId}?workspaceId=${encodeURIComponent(
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
    throw new Error(result.message || "Failed to delete supplier");
  }

  return result;
}
