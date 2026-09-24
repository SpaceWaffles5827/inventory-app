// Client-side API helper functions for locations
import type { Location, Item, Prisma } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

// ============================================
// Location structure type
// ============================================

export type LocationStructure = {
  label: string;
  value: string;
}[];

export type LocationTemplate = {
  levels: { label: string }[];
};

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
  items: Pick<Item, "id" | "itemNumber" | "name" | "status" | "unit"> &
    {
      quantity: number;
      minStock: number;
      maxStock: number;
      notes: string | null;
    }[];
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
        status: true;
        unit: true;
      };
    };
  };
}>;

// ============================================
// Request types
// ============================================

export type CreateLocationRequest = {
  code: string;
  barcode?: string; // Optional custom barcode
  structure: LocationStructure;
  capacity?: number;
  description?: string;
  workspaceId: string;
};

export type UpdateLocationRequest = {
  code?: string;
  barcode?: string; // Optional custom barcode
  structure?: LocationStructure;
  capacity?: number;
  description?: string;
  workspaceId: string;
};

export type UpdateWorkspaceStructureRequest = {
  workspaceId: string;
  structure: LocationTemplate;
};

// ============================================
// API Response types
// ============================================

export type LocationApiResponse = ApiResponse<{
  location?: LocationWithCount | LocationWithItems;
  locations?: LocationWithCount[];
}>;

export type WorkspaceStructureApiResponse = ApiResponse<{
  structure: LocationTemplate | null;
}>;

/**
 * Get workspace default location structure
 */
export async function getWorkspaceStructureApi(
  workspaceId: string
): Promise<WorkspaceStructureApiResponse> {
  return apiRequest<WorkspaceStructureApiResponse>(
    "/api/locations/workspace-structure",
    {
      query: { workspaceId },
      errorMessage: "Failed to fetch workspace structure",
    }
  );
}

/**
 * Update workspace default location structure
 */
export async function updateWorkspaceStructureApi(
  data: UpdateWorkspaceStructureRequest
): Promise<WorkspaceStructureApiResponse> {
  return apiRequest<WorkspaceStructureApiResponse>(
    "/api/locations/workspace-structure",
    {
      method: "PUT",
      body: data,
      errorMessage: "Failed to update workspace structure",
    }
  );
}

/**
 * Get all locations in a workspace
 */
export async function getLocationsApi(
  workspaceId: string
): Promise<LocationApiResponse> {
  return apiRequest<LocationApiResponse>("/api/locations", {
    query: { workspaceId },
    errorMessage: "Failed to fetch locations",
  });
}

/**
 * Get a single location by ID
 */
export async function getLocationByIdApi(
  locationId: string,
  workspaceId: string
): Promise<LocationApiResponse> {
  return apiRequest<LocationApiResponse>(`/api/locations/${locationId}`, {
    query: { workspaceId },
    errorMessage: "Failed to fetch location",
  });
}

/**
 * Create a new location
 */
export async function createLocationApi(
  data: CreateLocationRequest
): Promise<LocationApiResponse> {
  return apiRequest<LocationApiResponse>("/api/locations", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create location",
  });
}

/**
 * Update an existing location
 */
export async function updateLocationApi(
  locationId: string,
  data: UpdateLocationRequest
): Promise<LocationApiResponse> {
  return apiRequest<LocationApiResponse>(`/api/locations/${locationId}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update location",
  });
}

/**
 * Delete a location
 */
export async function deleteLocationApi(
  locationId: string,
  workspaceId: string
): Promise<LocationApiResponse> {
  return apiRequest<LocationApiResponse>(`/api/locations/${locationId}`, {
    method: "DELETE",
    query: { workspaceId },
    errorMessage: "Failed to delete location",
  });
}
