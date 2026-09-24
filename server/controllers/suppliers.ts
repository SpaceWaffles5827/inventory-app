import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, requireMembership, requireUserId } from "../utils/access";
import { badRequest, notFound, sendSuccess } from "../utils/http";
import { parseBody, parseQuery, zBooleanish, zId, zOptionalText, zText } from "../utils/validate";
import { getOnHandByItem } from "../utils/stock";

const workspaceQuery = z.object({ workspaceId: zId });

const zOptionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(191).email("Invalid email format").nullable().optional()
);

const supplierFields = {
  contactPerson: zOptionalText(191),
  email: zOptionalEmail,
  phone: zOptionalText(50),
  address: zOptionalText(191),
  isActive: zBooleanish.optional(),
};

const suppliersController = {
  // POST /api/suppliers
  createSupplier: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(z.object({ workspaceId: zId, name: zText(191), ...supplierFields }), req);
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.supplier.findFirst({
      where: { workspaceId: body.workspaceId, name: body.name },
      select: { id: true },
    });
    if (existing) throw badRequest("Supplier name already exists in this workspace");

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        contactPerson: body.contactPerson ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        isActive: body.isActive ?? true,
        workspaceId: body.workspaceId,
      },
    });
    return sendSuccess(res, { supplier }, "Supplier created successfully", 201);
  },

  // GET /api/suppliers?workspaceId=
  getSuppliers: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const suppliers = await prisma.supplier.findMany({
      where: { workspaceId },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });
    return sendSuccess(res, { suppliers });
  },

  // GET /api/suppliers/:id?workspaceId=
  getSupplierById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        _count: { select: { items: true } },
        items: {
          select: { id: true, itemNumber: true, name: true, status: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!supplier) throw notFound("Supplier not found");

    const onHand = await getOnHandByItem(prisma, workspaceId, supplier.items.map((i) => i.id));
    return sendSuccess(res, {
      supplier: {
        ...supplier,
        items: supplier.items.map((item) => ({ ...item, onHand: onHand.get(item.id) ?? 0 })),
      },
    });
  },

  // PATCH /api/suppliers/:id
  updateSupplier: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(
      z.object({ workspaceId: zId, name: zText(191).optional(), ...supplierFields }),
      req
    );
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.supplier.findFirst({ where: { id, workspaceId: body.workspaceId } });
    if (!existing) throw notFound("Supplier not found");

    if (body.name && body.name !== existing.name) {
      const dup = await prisma.supplier.findFirst({
        where: { workspaceId: body.workspaceId, name: body.name, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw badRequest("Supplier name already exists in this workspace");
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: { _count: { select: { items: true } } },
    });
    return sendSuccess(res, { supplier }, "Supplier updated successfully");
  },

  // DELETE /api/suppliers/:id?workspaceId= (ADMIN+)
  deleteSupplier: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId, PERMISSIONS.delete, {
      message: "You don't have permission to delete suppliers",
    });

    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, workspaceId },
      include: { _count: { select: { items: true } } },
    });
    if (!supplier) throw notFound("Supplier not found");
    if (supplier._count.items > 0) {
      throw badRequest(
        `Cannot delete supplier with ${supplier._count.items} item(s). Please reassign or delete the items first.`
      );
    }

    await prisma.supplier.delete({ where: { id: supplier.id } });
    return sendSuccess(res, {}, "Supplier deleted successfully");
  },
};

export default suppliersController;
