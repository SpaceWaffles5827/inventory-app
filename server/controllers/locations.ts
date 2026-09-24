import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, requireMembership, requireUserId } from "../utils/access";
import { HttpError, badRequest, notFound, sendSuccess } from "../utils/http";
import {
  parseBody,
  parseQuery,
  zId,
  zNonNegativeInt,
  zOptionalText,
  zText,
} from "../utils/validate";
import { withStockTransaction } from "../utils/stock";

// A location's structure: [{ label: "Zone", value: "A" }, ...]
const zStructure = z
  .array(
    z
      .object({
        label: z.string().trim().max(100),
        value: z.union([z.string(), z.number()]).transform(String),
      })
      .passthrough()
  )
  .min(1, "Location structure is required")
  .max(20);

// Workspace template: { levels: [{ label: "Zone" }, ...] }
const zTemplate = z
  .object({
    levels: z
      .array(z.object({ label: z.string().trim().min(1).max(100) }).passthrough())
      .min(1, "At least one level is required")
      .max(20),
  })
  .passthrough();

const optionalCapacity = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  zNonNegativeInt("Capacity").optional()
);

const createLocationSchema = z.object({
  workspaceId: zId,
  code: zText(100),
  barcode: zOptionalText(191),
  structure: zStructure,
  capacity: optionalCapacity,
  description: zOptionalText(191),
});

const updateLocationSchema = z.object({
  workspaceId: zId,
  code: zText(100).optional(),
  barcode: zOptionalText(191),
  structure: zStructure.optional(),
  capacity: optionalCapacity,
  description: zOptionalText(191),
});

const workspaceQuery = z.object({ workspaceId: zId });

/** LOC-<code>, then LOC-<code>#1, #2, ... until unused in the workspace. */
async function generateLocationBarcode(code: string, workspaceId: string, excludeId?: string) {
  const base = `LOC-${code}`;
  let candidate = base;
  for (let i = 1; ; i++) {
    const clash = await prisma.location.findFirst({
      where: { workspaceId, barcode: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}#${i}`;
  }
}

/** Units stored per location (from LotLocation, the source of truth). */
async function unitsByLocation(workspaceId: string, locationIds?: string[]) {
  const rows = await prisma.lotLocation.groupBy({
    by: ["locationId"],
    where: {
      location: { workspaceId },
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.locationId, r._sum.quantity ?? 0]));
}

const locationsController = {
  // GET /api/locations/workspace-structure?workspaceId=
  getWorkspaceStructure: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultLocationStructure: true },
    });
    return sendSuccess(res, { structure: workspace?.defaultLocationStructure || null });
  },

  // PUT /api/locations/workspace-structure (ADMIN+)
  updateWorkspaceStructure: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId, structure } = parseBody(
      z.object({ workspaceId: zId, structure: zTemplate }),
      req
    );
    await requireMembership(userId, workspaceId, PERMISSIONS.workspaceSettings, {
      message: "You don't have permission to update workspace settings",
    });

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { defaultLocationStructure: structure as Prisma.InputJsonValue },
      select: { defaultLocationStructure: true },
    });
    return sendSuccess(
      res,
      { structure: workspace.defaultLocationStructure },
      "Workspace structure updated successfully"
    );
  },

  // POST /api/locations
  createLocation: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(createLocationSchema, req);
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.location.findFirst({
      where: { workspaceId: body.workspaceId, code: body.code },
      select: { id: true },
    });
    if (existing) throw badRequest("Location code already exists in this workspace");

    const barcode = body.barcode || (await generateLocationBarcode(body.code, body.workspaceId));
    if (body.barcode) {
      const clash = await prisma.location.findFirst({
        where: { workspaceId: body.workspaceId, barcode },
        select: { id: true },
      });
      if (clash) throw badRequest("Location barcode already exists in this workspace");
    }

    const location = await prisma.location.create({
      data: {
        code: body.code,
        barcode,
        structure: body.structure as Prisma.InputJsonValue,
        capacity: body.capacity ?? 100,
        description: body.description ?? null,
        workspaceId: body.workspaceId,
      },
    });
    return sendSuccess(res, { location }, "Location created successfully", 201);
  },

  // GET /api/locations?workspaceId=
  getLocations: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const [locations, units] = await Promise.all([
      prisma.location.findMany({
        where: { workspaceId },
        include: { _count: { select: { items: true } } },
        orderBy: { code: "asc" },
      }),
      unitsByLocation(workspaceId),
    ]);

    return sendSuccess(res, {
      locations: locations.map((l) => ({ ...l, totalUnits: units.get(l.id) ?? 0 })),
    });
  },

  // GET /api/locations/:id?workspaceId=
  getLocationById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const location = await prisma.location.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        _count: { select: { items: true } },
        items: {
          include: {
            item: {
              select: { id: true, itemNumber: true, name: true, status: true, unit: true },
            },
          },
          orderBy: { item: { name: "asc" } },
        },
      },
    });
    if (!location) throw notFound("Location not found");

    const units = await unitsByLocation(workspaceId, [location.id]);
    return sendSuccess(res, {
      location: {
        ...location,
        totalUnits: units.get(location.id) ?? 0,
        items: location.items.map((il) => ({
          id: il.item.id,
          itemNumber: il.item.itemNumber,
          name: il.item.name,
          status: il.item.status,
          unit: il.item.unit,
          quantity: il.quantity,
          minStock: il.minStock,
          maxStock: il.maxStock,
          notes: il.notes,
        })),
      },
    });
  },

  // PATCH /api/locations/:id
  updateLocation: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(updateLocationSchema, req);
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.location.findFirst({
      where: { id, workspaceId: body.workspaceId },
    });
    if (!existing) throw notFound("Location not found");

    if (body.code && body.code !== existing.code) {
      const dup = await prisma.location.findFirst({
        where: { workspaceId: body.workspaceId, code: body.code, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw badRequest("Location code already exists in this workspace");
    }
    if (body.barcode && body.barcode !== existing.barcode) {
      const dup = await prisma.location.findFirst({
        where: { workspaceId: body.workspaceId, barcode: body.barcode, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw badRequest("Location barcode already exists in this workspace");
    }

    const data: Prisma.LocationUpdateInput = {};
    if (body.code) {
      data.code = body.code;
      // New code without an explicit barcode -> regenerate the barcode.
      if (body.barcode === undefined && body.code !== existing.code) {
        data.barcode = await generateLocationBarcode(body.code, body.workspaceId, id);
      }
    }
    if (body.barcode !== undefined) data.barcode = body.barcode;
    if (body.structure) data.structure = body.structure as Prisma.InputJsonValue;
    if (body.capacity !== undefined) data.capacity = body.capacity;
    if (body.description !== undefined) data.description = body.description;

    const location = await prisma.location.update({
      where: { id },
      data,
      include: { _count: { select: { items: true } } },
    });
    return sendSuccess(res, { location }, "Location updated successfully");
  },

  // DELETE /api/locations/:id?workspaceId= (ADMIN+). Refused while stock remains.
  deleteLocation: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId, PERMISSIONS.delete, {
      message: "You don't have permission to delete locations",
    });

    await withStockTransaction(async (tx) => {
      // Lock the location (blocks new stock rows referencing it) and every
      // stock row stored there, then read the latest committed quantities.
      const loc = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM locations WHERE id = ${id} AND workspaceId = ${workspaceId} FOR UPDATE`;
      if (loc.length === 0) throw notFound("Location not found");

      const stock = await tx.$queryRaw<{ lotId: string; quantity: number }[]>`
        SELECT lotId, quantity FROM lot_locations WHERE locationId = ${id} FOR UPDATE`;
      const units = stock.reduce((s, r) => s + Number(r.quantity), 0);
      if (units > 0) {
        const lots = stock.filter((r) => Number(r.quantity) > 0).map((r) => r.lotId);
        const items = await tx.lot.findMany({
          where: { id: { in: lots } },
          distinct: ["itemId"],
          select: { itemId: true },
        });
        throw new HttpError(
          409,
          `Cannot delete this location: it still holds ${units} unit(s) of ${items.length} item(s). Transfer or remove that stock first.`,
          { data: { units, itemCount: items.length } }
        );
      }

      // Empty stock rows and item assignments cascade with the location;
      // transaction history keeps the row with the location reference nulled.
      await tx.location.delete({ where: { id } });
    });

    return sendSuccess(res, {}, "Location deleted successfully");
  },
};

export default locationsController;
