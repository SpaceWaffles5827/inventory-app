// Client-side API helper functions for lot tracking
import type { Prisma } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

// ============================================
// Extended types for location details
// ============================================

export type LotLocationWithDetails = {
  id: string;
  lotId: string;
  locationId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  locationCode: string; // Added by backend transformation
  location: {
    id: string;
    code: string;
    name?: string | null;
    type?: string | null;
  };
};

// ============================================
// Derive types from Prisma queries
// ============================================

// Base Prisma payload for lot with relations
type LotWithRelationsPayload = Prisma.LotGetPayload<{
  include: {
    supplier: true;
    creator: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    locations: {
      include: {
        location: true;
      };
    };
  };
}>;

// Base Prisma payload for lot with full details
type LotWithDetailsPayload = Prisma.LotGetPayload<{
  include: {
    item: true;
    supplier: true;
    creator: {
      select: {
        id: true;
        name: true;
        email: true;
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
      };
    };
  };
}>;

// Extended types with locationCode added by backend
export type LotWithRelations = Omit<LotWithRelationsPayload, "locations"> & {
  locations: LotLocationWithDetails[];
};

export type LotWithDetails = Omit<LotWithDetailsPayload, "locations"> & {
  locations: LotLocationWithDetails[];
};

// ============================================
// Request types
// ============================================

export type CreateLotRequest = {
  lotNumber: string;
  quantity: number;
  receivedDate?: string;
  manufactureDate?: string;
  expirationDate?: string;
  supplierId?: string;
  poNumber?: string;
  notes?: string;
  locationAssignments?: Array<{
    locationId: string;
    quantity: number;
  }>;
};

export type UpdateLotRequest = {
  lotNumber?: string;
  status?: "ACTIVE" | "DEPLETED" | "EXPIRED" | "QUARANTINED" | "RECALLED";
  receivedDate?: string;
  manufactureDate?: string;
  expirationDate?: string;
  supplierId?: string;
  poNumber?: string;
  notes?: string;
};

export type UpdateLotStatusRequest = {
  status?: "ACTIVE" | "DEPLETED" | "EXPIRED" | "QUARANTINED" | "RECALLED";
  notes?: string;
};

export type AdjustLotQuantityRequest = {
  type: "INPUT" | "OUTPUT";
  quantity: number;
  reason: string;
  locationId: string;
};

// ============================================
// API Response types
// ============================================

export type LotsApiResponse = ApiResponse<{
  lot?: LotWithRelations | LotWithDetails;
  lots?: LotWithRelations[];
}>;

/**
 * Get all lots for an item
 */
export async function getLotsByItemApi(
  itemId: string
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/item/${itemId}`, {
    errorMessage: "Failed to fetch lots",
  });
}

/**
 * Get a single lot by ID with full details
 */
export async function getLotByIdApi(id: string): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/${id}`, {
    errorMessage: "Failed to fetch lot",
  });
}

/**
 * Create a new lot for an item
 */
export async function createLotApi(
  itemId: string,
  data: CreateLotRequest
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/item/${itemId}`, {
    method: "POST",
    body: data,
    errorMessage: "Failed to create lot",
  });
}

/**
 * Update lot details (lot number, dates, supplier, notes, etc.)
 */
export async function updateLotApi(
  id: string,
  data: UpdateLotRequest
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/${id}`, {
    method: "PUT",
    body: data,
    errorMessage: "Failed to update lot",
  });
}

/**
 * Update lot status (e.g., mark as expired, quarantined)
 */
export async function updateLotStatusApi(
  id: string,
  data: UpdateLotStatusRequest
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/${id}/status`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update lot status",
  });
}

/**
 * Adjust lot quantity (add or remove from specific lot)
 */
export async function adjustLotQuantityApi(
  id: string,
  data: AdjustLotQuantityRequest
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/${id}/adjust`, {
    method: "POST",
    body: data,
    errorMessage: "Failed to adjust lot quantity",
  });
}

/**
 * Delete a lot (soft delete by marking as depleted)
 */
export async function deleteLotApi(id: string): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>(`/api/lots/${id}`, {
    method: "DELETE",
    errorMessage: "Failed to delete lot",
  });
}

/**
 * Get expiring lots for a workspace (expires within specified days)
 */
export async function getExpiringLotsApi(
  workspaceId: string,
  daysUntilExpiration: number = 30
): Promise<LotsApiResponse> {
  return apiRequest<LotsApiResponse>("/api/lots/expiring", {
    query: { workspaceId, days: daysUntilExpiration },
    errorMessage: "Failed to fetch expiring lots",
  });
}
