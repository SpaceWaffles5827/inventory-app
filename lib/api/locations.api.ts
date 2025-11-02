// Client-side API helper functions for locations
import type { Location, Item, Prisma } from "@prisma/client";
import type { ApiResponse } from "./types";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Location with item count
export type LocationWithCount = Location & {
  _count: {
    items: number;
  };
};

// Location with items (for detail view)
export type LocationWithItems = Location & {
  _count: {
    items: number;
  };
  items: Pick<Item, "id" | "itemNumber" | "name" | "onHand" | "status">[];
};

// Or use Prisma's built-in payload type
export type LocationWithItemsAlt = Prisma.LocationGetPayload<{
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

export type CreateLocationRequest = {
  code: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  capacity?: number;
  description?: string;
  workspaceId: string;
};

export type UpdateLocationRequest = {
  code?: string;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  capacity?: number;
  description?: string;
  workspaceId: string;
};

// ============================================
// API Response types
// ============================================

export type LocationApiResponse = ApiResponse<{
  location?: LocationWithCount | LocationWithItems;
  locations?: LocationWithCount[];
}>;

/**
 * Get all locations in a workspace
 */
export async function getLocationsApi(
  workspaceId: string
): Promise<LocationApiResponse> {
  const response = await fetch(
    `/api/locations?workspaceId=${encodeURIComponent(workspaceId)}`,
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
    throw new Error(result.message || "Failed to fetch locations");
  }

  return result;
}

/**
 * Get a single location by ID
 */
export async function getLocationByIdApi(
  locationId: string,
  workspaceId: string
): Promise<LocationApiResponse> {
  const response = await fetch(
    `/api/locations/${locationId}?workspaceId=${encodeURIComponent(
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
    throw new Error(result.message || "Failed to fetch location");
  }

  return result;
}

/**
 * Create a new location
 */
export async function createLocationApi(
  data: CreateLocationRequest
): Promise<LocationApiResponse> {
  const response = await fetch("/api/locations", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create location");
  }

  return result;
}

/**
 * Update an existing location
 */
export async function updateLocationApi(
  locationId: string,
  data: UpdateLocationRequest
): Promise<LocationApiResponse> {
  const response = await fetch(`/api/locations/${locationId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update location");
  }

  return result;
}

/**
 * Delete a location
 */
export async function deleteLocationApi(
  locationId: string,
  workspaceId: string
): Promise<LocationApiResponse> {
  const response = await fetch(
    `/api/locations/${locationId}?workspaceId=${encodeURIComponent(
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
    throw new Error(result.message || "Failed to delete location");
  }

  return result;
}
