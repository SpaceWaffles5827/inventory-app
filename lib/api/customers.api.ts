// Client-side API helper functions for customers
import type { Customer, Item } from "@prisma/client";
import type { ApiResponse } from "./types";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Customer with item count
export type CustomerWithCount = Customer & {
  _count: {
    items: number;
  };
};

// Customer with items (for detail view)
// onHand is a derived field (sum of lot-location quantities) added by the API,
// not a stored column on Item.
export type CustomerWithItems = Customer & {
  _count: {
    items: number;
  };
  items: Array<{
    id: string;
    quantity: number;
    lastOrderDate: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    item: Pick<Item, "id" | "itemNumber" | "name" | "status" | "cost"> & {
      onHand: number;
    };
  }>;
};

// ============================================
// Request types
// ============================================

export type CreateCustomerRequest = {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  status?: "ACTIVE" | "INACTIVE";
  workspaceId: string;
};

export type UpdateCustomerRequest = {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  status?: "ACTIVE" | "INACTIVE";
  orderCount?: number;
  totalSpent?: number;
  workspaceId: string;
};

export type AttachItemToCustomerRequest = {
  customerId: string;
  itemId: string;
  quantity?: number;
  notes?: string;
};

export type GetCustomersParams = {
  workspaceId: string;
  status?: "ACTIVE" | "INACTIVE";
  search?: string;
};

// ============================================
// API Response types
// ============================================

export type CustomerApiResponse = ApiResponse<{
  customer?: CustomerWithCount | CustomerWithItems;
  customers?: CustomerWithCount[];
}>;

export type CustomerStatsApiResponse = ApiResponse<{
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}>;

export type ItemCustomerApiResponse = ApiResponse<{
  itemCustomer?: {
    id: string;
    quantity: number;
    lastOrderDate: Date | null;
    notes: string | null;
    item: Pick<Item, "id" | "itemNumber" | "name" | "status" | "cost"> & {
      onHand: number;
    };
    customer: Customer;
  };
}>;

/**
 * Get all customers in a workspace
 */
export async function getCustomersApi(
  params: GetCustomersParams
): Promise<CustomerApiResponse> {
  const queryParams = new URLSearchParams({
    workspaceId: params.workspaceId,
  });

  if (params.status) {
    queryParams.append("status", params.status);
  }

  if (params.search) {
    queryParams.append("search", params.search);
  }

  const response = await fetch(`/api/customers?${queryParams.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch customers");
  }

  return result;
}

/**
 * Get a single customer by ID
 */
export async function getCustomerByIdApi(
  customerId: string,
  workspaceId: string
): Promise<CustomerApiResponse> {
  const response = await fetch(
    `/api/customers/${customerId}?workspaceId=${encodeURIComponent(
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
    throw new Error(result.message || "Failed to fetch customer");
  }

  return result;
}

/**
 * Create a new customer
 */
export async function createCustomerApi(
  data: CreateCustomerRequest
): Promise<CustomerApiResponse> {
  const response = await fetch("/api/customers", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create customer");
  }

  return result;
}

/**
 * Update an existing customer
 */
export async function updateCustomerApi(
  customerId: string,
  data: UpdateCustomerRequest
): Promise<CustomerApiResponse> {
  const response = await fetch(`/api/customers/${customerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update customer");
  }

  return result;
}

/**
 * Delete a customer
 */
export async function deleteCustomerApi(
  customerId: string,
  workspaceId: string
): Promise<CustomerApiResponse> {
  const queryParams = new URLSearchParams({
    workspaceId: workspaceId,
  });

  const response = await fetch(
    `/api/customers/${customerId}?${queryParams.toString()}`,
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
    throw new Error(result.message || "Failed to delete customer");
  }

  return result;
}

/**
 * Get customer statistics
 */
export async function getCustomerStatsApi(
  workspaceId: string
): Promise<CustomerStatsApiResponse> {
  const queryParams = new URLSearchParams({
    workspaceId: workspaceId,
  });

  const response = await fetch(
    `/api/customers/stats?${queryParams.toString()}`,
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
    throw new Error(result.message || "Failed to fetch customer statistics");
  }

  return result;
}

/**
 * Attach an item to a customer
 */
export async function attachItemToCustomerApi(
  data: AttachItemToCustomerRequest
): Promise<ItemCustomerApiResponse> {
  const response = await fetch("/api/customers/attach-item", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to attach item to customer");
  }

  return result;
}

/**
 * Detach an item from a customer
 */
export async function detachItemFromCustomerApi(
  customerId: string,
  itemId: string
): Promise<ApiResponse<undefined>> {
  const response = await fetch(`/api/customers/${customerId}/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to detach item from customer");
  }

  return result;
}
