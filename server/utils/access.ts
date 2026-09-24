// Tenant isolation + role checks.
//
// Every id that comes from a client must be proven to belong to the caller's
// workspace, and the caller must be a member of that workspace with a high
// enough role. Controllers use these helpers instead of ad-hoc queries.
//
// Role ladder: MEMBER < ADMIN < OWNER (see PERMISSIONS below for the matrix).
import { Request } from "express";
import { Prisma, PrismaClient, Role, WorkspaceMember } from "@prisma/client";
import prisma from "./prisma";
import { HttpError, forbidden, notFound, unauthorized, badRequest } from "./http";

type Db = PrismaClient | Prisma.TransactionClient;

export const ROLE_RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export const hasRole = (role: Role, minRole: Role) =>
  ROLE_RANK[role] >= ROLE_RANK[minRole];

/**
 * Minimum role per action. Reads are always MEMBER.
 *  - MEMBER: view everything, stock operations (adjust / transfer / receive
 *    lots / adjust lots), create + edit items, lots, locations, categories,
 *    suppliers, customers, upload images.
 *  - ADMIN: anything destructive (delete items, locations, categories,
 *    suppliers, customers, images), toggling lot tracking on an item,
 *    workspace settings (name, description, location structure), invitations,
 *    member management (see members.ts for the role-change rules).
 *  - OWNER: delete the workspace, grant/revoke OWNER.
 */
export const PERMISSIONS = {
  view: "MEMBER",
  stockOperation: "MEMBER",
  edit: "MEMBER",
  delete: "ADMIN",
  toggleLotTracking: "ADMIN",
  workspaceSettings: "ADMIN",
  manageInvitations: "ADMIN",
  manageMembers: "ADMIN",
  deleteWorkspace: "OWNER",
} as const satisfies Record<string, Role>;

/** The authenticated user's id, or a 401. */
export function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw unauthorized();
  return id;
}

/**
 * Ensure `userId` is a member of `workspaceId` with at least `minRole`.
 * 403 when not a member / role too low. Returns the membership row.
 */
export async function requireMembership(
  userId: string,
  workspaceId: string | null | undefined,
  minRole: Role = "MEMBER",
  opts: { db?: Db; message?: string } = {}
): Promise<WorkspaceMember> {
  if (!workspaceId || typeof workspaceId !== "string") {
    throw badRequest("Workspace ID is required");
  }
  const db = opts.db ?? prisma;
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) throw forbidden("You don't have access to this workspace");
  if (!hasRole(member.role, minRole)) {
    throw forbidden(
      opts.message ??
        `You don't have permission to do this (requires ${minRole.toLowerCase()} role or higher)`
    );
  }
  return member;
}

// ---------------------------------------------------------------------------
// "Does this id belong to this workspace?"
// ---------------------------------------------------------------------------

export type ScopedModel =
  | "item"
  | "location"
  | "category"
  | "supplier"
  | "customer"
  | "lot";

const LABELS: Record<ScopedModel, [string, string]> = {
  item: ["Item", "items"],
  location: ["Location", "locations"],
  category: ["Category", "categories"],
  supplier: ["Supplier", "suppliers"],
  customer: ["Customer", "customers"],
  lot: ["Lot", "lots"],
};

async function countInWorkspace(
  db: Db,
  model: ScopedModel,
  ids: string[],
  workspaceId: string
): Promise<number> {
  const where = { id: { in: ids }, workspaceId };
  switch (model) {
    case "item":
      return db.item.count({ where });
    case "location":
      return db.location.count({ where });
    case "category":
      return db.category.count({ where });
    case "supplier":
      return db.supplier.count({ where });
    case "customer":
      return db.customer.count({ where });
    case "lot":
      return db.lot.count({ where });
  }
}

/**
 * Throw unless `id` is a `model` row inside `workspaceId`.
 * Defaults to 400 (a bad reference in a request body); pass status 404 when
 * the id is the resource being addressed.
 */
export async function assertInWorkspace(
  model: ScopedModel,
  id: string,
  workspaceId: string,
  opts: { db?: Db; status?: number; message?: string } = {}
): Promise<void> {
  const count = await countInWorkspace(opts.db ?? prisma, model, [id], workspaceId);
  if (count !== 1) {
    throw new HttpError(
      opts.status ?? 400,
      opts.message ?? `${LABELS[model][0]} not found in this workspace`
    );
  }
}

/** Like assertInWorkspace for a list of ids (duplicates are ignored). */
export async function assertAllInWorkspace(
  model: ScopedModel,
  ids: string[],
  workspaceId: string,
  opts: { db?: Db; status?: number; message?: string } = {}
): Promise<void> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return;
  const count = await countInWorkspace(opts.db ?? prisma, model, unique, workspaceId);
  if (count !== unique.length) {
    throw new HttpError(
      opts.status ?? 400,
      opts.message ?? `One or more ${LABELS[model][1]} not found in this workspace`
    );
  }
}

/** Verify optional foreign keys on a payload in one go (undefined/null are skipped). */
export async function assertRefsInWorkspace(
  workspaceId: string,
  refs: {
    categoryId?: string | null;
    supplierId?: string | null;
    locationIds?: string[] | null;
    customerIds?: string[] | null;
  },
  db?: Db
): Promise<void> {
  if (refs.categoryId) await assertInWorkspace("category", refs.categoryId, workspaceId, { db });
  if (refs.supplierId) await assertInWorkspace("supplier", refs.supplierId, workspaceId, { db });
  if (refs.locationIds?.length) await assertAllInWorkspace("location", refs.locationIds, workspaceId, { db });
  if (refs.customerIds?.length) await assertAllInWorkspace("customer", refs.customerIds, workspaceId, { db });
}

// ---------------------------------------------------------------------------
// Load a resource by id + check the caller may act on it
// ---------------------------------------------------------------------------

export async function loadItemForUser(
  userId: string,
  itemId: string,
  minRole: Role = "MEMBER",
  message?: string
) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Item not found");
  const member = await requireMembership(userId, item.workspaceId, minRole, { message });
  return { item, member };
}

export async function loadLotForUser(
  userId: string,
  lotId: string,
  minRole: Role = "MEMBER",
  message?: string
) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw notFound("Lot not found");
  const member = await requireMembership(userId, lot.workspaceId, minRole, { message });
  return { lot, member };
}
