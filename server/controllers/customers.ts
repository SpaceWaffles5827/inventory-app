import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, requireMembership, requireUserId } from "../utils/access";
import { badRequest, notFound, sendSuccess } from "../utils/http";
import {
  parseBody,
  parseQuery,
  zId,
  zMoney,
  zNonNegativeInt,
  zOptionalText,
  zText,
} from "../utils/validate";
import { getOnHandByItem } from "../utils/stock";

const workspaceQuery = z.object({ workspaceId: zId });
const zStatus = z.enum(["ACTIVE", "INACTIVE"]);

const zOptionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(191).email("Invalid email format").nullable().optional()
);

const optionalNumber = <S extends z.ZodTypeAny>(schema: S) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

const customerFields = {
  contactPerson: zOptionalText(191),
  email: zOptionalEmail,
  phone: zOptionalText(50),
  address: zOptionalText(191),
  company: zOptionalText(191),
  status: zStatus.optional(),
};

const customersController = {
  // POST /api/customers
  createCustomer: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(z.object({ workspaceId: zId, name: zText(191), ...customerFields }), req);
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.customer.findFirst({
      where: { workspaceId: body.workspaceId, name: body.name },
      select: { id: true },
    });
    if (existing) throw badRequest("Customer name already exists in this workspace");

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        contactPerson: body.contactPerson ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        company: body.company ?? null,
        status: body.status ?? "ACTIVE",
        workspaceId: body.workspaceId,
      },
    });
    return sendSuccess(res, { customer }, "Customer created successfully", 201);
  },

  // GET /api/customers?workspaceId=&status=&search=
  getCustomers: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(
      workspaceQuery.extend({
        status: z.preprocess((v) => (v === "" ? undefined : v), zStatus.optional()),
        search: z.string().trim().max(191).optional(),
      }),
      req
    );
    await requireMembership(userId, q.workspaceId);

    const where: Prisma.CustomerWhereInput = { workspaceId: q.workspaceId };
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { contactPerson: { contains: q.search } },
        { email: { contains: q.search } },
        { company: { contains: q.search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });
    return sendSuccess(res, { customers });
  },

  // GET /api/customers/:id?workspaceId=
  getCustomerById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        _count: { select: { items: true } },
        items: {
          include: {
            item: {
              select: { id: true, itemNumber: true, name: true, status: true, cost: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (!customer) throw notFound("Customer not found");

    const onHand = await getOnHandByItem(prisma, workspaceId, customer.items.map((ic) => ic.item.id));
    return sendSuccess(res, {
      customer: {
        ...customer,
        items: customer.items.map((ic) => ({
          ...ic,
          item: { ...ic.item, onHand: onHand.get(ic.item.id) ?? 0 },
        })),
      },
    });
  },

  // PATCH /api/customers/:id
  updateCustomer: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(
      z.object({
        workspaceId: zId,
        name: zText(191).optional(),
        ...customerFields,
        orderCount: optionalNumber(zNonNegativeInt("Order count")),
        totalSpent: optionalNumber(zMoney("Total spent")),
      }),
      req
    );
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.customer.findFirst({ where: { id, workspaceId: body.workspaceId } });
    if (!existing) throw notFound("Customer not found");

    if (body.name && body.name !== existing.name) {
      const dup = await prisma.customer.findFirst({
        where: { workspaceId: body.workspaceId, name: body.name, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw badRequest("Customer name already exists in this workspace");
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.company !== undefined && {
          company: body.company || body.name || existing.name,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.orderCount !== undefined && { orderCount: body.orderCount }),
        ...(body.totalSpent !== undefined && { totalSpent: body.totalSpent }),
      },
      include: { _count: { select: { items: true } } },
    });
    return sendSuccess(res, { customer }, "Customer updated successfully");
  },

  // DELETE /api/customers/:id?workspaceId= (ADMIN+)
  deleteCustomer: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId, PERMISSIONS.delete, {
      message: "You don't have permission to delete customers",
    });

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, workspaceId },
      include: { _count: { select: { items: true } } },
    });
    if (!customer) throw notFound("Customer not found");
    if (customer._count.items > 0) {
      throw badRequest(
        `Cannot delete customer with ${customer._count.items} associated item(s). Please remove the associations first.`
      );
    }

    await prisma.customer.delete({ where: { id: customer.id } });
    return sendSuccess(res, {}, "Customer deleted successfully");
  },

  // POST /api/customers/attach-item  { customerId, itemId, quantity?, notes? }
  attachItemToCustomer: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      z.object({
        customerId: zId,
        itemId: zId,
        quantity: optionalNumber(zNonNegativeInt("Quantity")),
        notes: zOptionalText(1000),
      }),
      req
    );

    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { workspaceId: true },
    });
    if (!customer) throw notFound("Customer not found");
    await requireMembership(userId, customer.workspaceId, PERMISSIONS.edit);

    const item = await prisma.item.findFirst({
      where: { id: body.itemId, workspaceId: customer.workspaceId },
      select: { id: true },
    });
    if (!item) throw notFound("Item not found in this workspace");

    const key = { itemId_customerId: { itemId: body.itemId, customerId: body.customerId } };
    const existing = await prisma.itemCustomer.findUnique({ where: key });

    if (existing) {
      const updated = await prisma.itemCustomer.update({
        where: key,
        data: {
          quantity: body.quantity || existing.quantity,
          notes: body.notes !== undefined ? body.notes : existing.notes,
          lastOrderDate: new Date(),
        },
        include: { item: true, customer: true },
      });
      return sendSuccess(res, { itemCustomer: updated }, "Item-customer association updated successfully");
    }

    const itemCustomer = await prisma.itemCustomer.create({
      data: {
        itemId: body.itemId,
        customerId: body.customerId,
        quantity: body.quantity ?? 0,
        notes: body.notes ?? null,
        lastOrderDate: new Date(),
      },
      include: { item: true, customer: true },
    });
    return sendSuccess(res, { itemCustomer }, "Item attached to customer successfully", 201);
  },

  // DELETE /api/customers/:customerId/items/:itemId
  detachItemFromCustomer: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { customerId, itemId } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { workspaceId: true },
    });
    if (!customer) throw notFound("Customer not found");
    await requireMembership(userId, customer.workspaceId, PERMISSIONS.edit);

    const key = { itemId_customerId: { itemId, customerId } };
    const association = await prisma.itemCustomer.findUnique({ where: key });
    if (!association) throw notFound("Item-customer association not found");

    await prisma.itemCustomer.delete({ where: key });
    return sendSuccess(res, {}, "Item detached from customer successfully");
  },

  // GET /api/customers/stats?workspaceId=
  getCustomerStats: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const [totalCustomers, activeCustomers, sums] = await Promise.all([
      prisma.customer.count({ where: { workspaceId } }),
      prisma.customer.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.customer.aggregate({
        where: { workspaceId },
        _sum: { orderCount: true, totalSpent: true },
      }),
    ]);
    const totalOrders = sums._sum.orderCount ?? 0;
    const totalRevenue = sums._sum.totalSpent ?? 0;

    return sendSuccess(res, {
      totalCustomers,
      activeCustomers,
      inactiveCustomers: totalCustomers - activeCustomers,
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    });
  },
};

export default customersController;
