// Client-side API helper functions for lot tracking
import type { ApiResponse } from "./types";
import { Prisma } from "@prisma/client";

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

// Base Prisma args for lot with relations
export const lotWithRelationsArgs = Prisma.validator<Prisma.LotDefaultArgs>()({
  include: {
    supplier: true,
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    locations: {
      include: {
        location: true,
      },
    },
  },
});

// Base Prisma args for lot with full details
export const lotWithDetailsArgs = Prisma.validator<Prisma.LotDefaultArgs>()({
  include: {
    item: true,
    supplier: true,
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
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
      orderBy: {
        createdAt: "desc",
      },
    },
  },
});

// Extended types with locationCode added by backend
export type LotWithRelations = Omit<
  Prisma.LotGetPayload<typeof lotWithRelationsArgs>,
  "locations"
> & {
  locations: LotLocationWithDetails[];
};

export type LotWithDetails = Omit<
  Prisma.LotGetPayload<typeof lotWithDetailsArgs>,
  "locations"
> & {
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
  const response = await fetch(`/api/lots/item/${itemId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch lots");
  }

  return result;
}

/**
 * Get a single lot by ID with full details
 */
export async function getLotByIdApi(id: string): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch lot");
  }

  return result;
}

/**
 * Create a new lot for an item
 */
export async function createLotApi(
  itemId: string,
  data: CreateLotRequest
): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/item/${itemId}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create lot");
  }

  return result;
}

/**
 * Update lot details (lot number, dates, supplier, notes, etc.)
 */
export async function updateLotApi(
  id: string,
  data: UpdateLotRequest
): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update lot");
  }

  return result;
}

/**
 * Update lot status (e.g., mark as expired, quarantined)
 */
export async function updateLotStatusApi(
  id: string,
  data: UpdateLotStatusRequest
): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update lot status");
  }

  return result;
}

/**
 * Adjust lot quantity (add or remove from specific lot)
 */
export async function adjustLotQuantityApi(
  id: string,
  data: AdjustLotQuantityRequest
): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/${id}/adjust`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to adjust lot quantity");
  }

  return result;
}

/**
 * Delete a lot (soft delete by marking as depleted)
 */
export async function deleteLotApi(id: string): Promise<LotsApiResponse> {
  const response = await fetch(`/api/lots/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to delete lot");
  }

  return result;
}

/**
 * Get expiring lots for a workspace (expires within specified days)
 */
export async function getExpiringLotsApi(
  workspaceId: string,
  daysUntilExpiration: number = 30
): Promise<LotsApiResponse> {
  const response = await fetch(
    `/api/lots/expiring?workspaceId=${workspaceId}&days=${daysUntilExpiration}`,
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
    throw new Error(result.message || "Failed to fetch expiring lots");
  }

  return result;
}
