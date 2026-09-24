// Client-side API helper functions for customers
import type { Customer, Item } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

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
  return apiRequest<CustomerApiResponse>("/api/customers", {
    query: {
      workspaceId: params.workspaceId,
      status: params.status,
      search: params.search,
    },
    errorMessage: "Failed to fetch customers",
  });
}

/**
 * Get a single customer by ID
 */
export async function getCustomerByIdApi(
  customerId: string,
  workspaceId: string
): Promise<CustomerApiResponse> {
  return apiRequest<CustomerApiResponse>(`/api/customers/${customerId}`, {
    query: { workspaceId },
    errorMessage: "Failed to fetch customer",
  });
}

/**
 * Create a new customer
 */
export async function createCustomerApi(
  data: CreateCustomerRequest
): Promise<CustomerApiResponse> {
  return apiRequest<CustomerApiResponse>("/api/customers", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create customer",
  });
}

/**
 * Update an existing customer
 */
export async function updateCustomerApi(
  customerId: string,
  data: UpdateCustomerRequest
): Promise<CustomerApiResponse> {
  return apiRequest<CustomerApiResponse>(`/api/customers/${customerId}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update customer",
  });
}

/**
 * Delete a customer
 */
export async function deleteCustomerApi(
  customerId: string,
  workspaceId: string
): Promise<CustomerApiResponse> {
  return apiRequest<CustomerApiResponse>(`/api/customers/${customerId}`, {
    method: "DELETE",
    query: { workspaceId },
    errorMessage: "Failed to delete customer",
  });
}

/**
 * Get customer statistics
 */
export async function getCustomerStatsApi(
  workspaceId: string
): Promise<CustomerStatsApiResponse> {
  return apiRequest<CustomerStatsApiResponse>("/api/customers/stats", {
    query: { workspaceId },
    errorMessage: "Failed to fetch customer statistics",
  });
}

/**
 * Attach an item to a customer
 */
export async function attachItemToCustomerApi(
  data: AttachItemToCustomerRequest
): Promise<ItemCustomerApiResponse> {
  return apiRequest<ItemCustomerApiResponse>("/api/customers/attach-item", {
    method: "POST",
    body: data,
    errorMessage: "Failed to attach item to customer",
  });
}

/**
 * Detach an item from a customer
 */
export async function detachItemFromCustomerApi(
  customerId: string,
  itemId: string
): Promise<ApiResponse<undefined>> {
  return apiRequest<ApiResponse<undefined>>(
    `/api/customers/${customerId}/items/${itemId}`,
    {
      method: "DELETE",
      errorMessage: "Failed to detach item from customer",
    }
  );
}
