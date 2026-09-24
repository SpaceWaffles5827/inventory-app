import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, requireMembership, requireUserId } from "../utils/access";
import { badRequest, notFound, sendSuccess } from "../utils/http";
import { parseBody, parseQuery, zId, zOptionalText, zText } from "../utils/validate";
import { getOnHandByItem } from "../utils/stock";

const workspaceQuery = z.object({ workspaceId: zId });

const categoriesController = {
  // POST /api/categories
  createCategory: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      z.object({ workspaceId: zId, name: zText(191), description: zOptionalText(191) }),
      req
    );
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.category.findFirst({
      where: { workspaceId: body.workspaceId, name: body.name },
      select: { id: true },
    });
    if (existing) throw badRequest("Category name already exists in this workspace");

    const category = await prisma.category.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        workspaceId: body.workspaceId,
      },
    });
    return sendSuccess(res, { category }, "Category created successfully", 201);
  },

  // GET /api/categories?workspaceId=
  getCategories: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const categories = await prisma.category.findMany({
      where: { workspaceId },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });

    return sendSuccess(res, {
      categories: categories.map((category) => ({
        ...category,
        itemCount: category._count.items,
        _count: undefined,
      })),
    });
  },

  // GET /api/categories/:id?workspaceId=
  getCategoryById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const category = await prisma.category.findFirst({
      where: { id: req.params.id, workspaceId },
      include: {
        _count: { select: { items: true } },
        items: {
          select: { id: true, itemNumber: true, name: true, status: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!category) throw notFound("Category not found");

    const onHand = await getOnHandByItem(prisma, workspaceId, category.items.map((i) => i.id));
    return sendSuccess(res, {
      category: {
        ...category,
        items: category.items.map((item) => ({ ...item, onHand: onHand.get(item.id) ?? 0 })),
      },
    });
  },

  // PATCH /api/categories/:id
  updateCategory: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(
      z.object({ workspaceId: zId, name: zText(191).optional(), description: zOptionalText(191) }),
      req
    );
    await requireMembership(userId, body.workspaceId, PERMISSIONS.edit);

    const existing = await prisma.category.findFirst({ where: { id, workspaceId: body.workspaceId } });
    if (!existing) throw notFound("Category not found");

    if (body.name && body.name !== existing.name) {
      const dup = await prisma.category.findFirst({
        where: { workspaceId: body.workspaceId, name: body.name, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw badRequest("Category name already exists in this workspace");
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      include: { _count: { select: { items: true } } },
    });
    return sendSuccess(res, { category }, "Category updated successfully");
  },

  // DELETE /api/categories/:id?workspaceId= (ADMIN+)
  deleteCategory: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId, PERMISSIONS.delete, {
      message: "You don't have permission to delete categories",
    });

    const category = await prisma.category.findFirst({
      where: { id: req.params.id, workspaceId },
      include: { _count: { select: { items: true } } },
    });
    if (!category) throw notFound("Category not found");
    if (category._count.items > 0) {
      throw badRequest(
        `Cannot delete category with ${category._count.items} item(s). Please reassign or delete the items first.`
      );
    }

    await prisma.category.delete({ where: { id: category.id } });
    return sendSuccess(res, {}, "Category deleted successfully");
  },
};

export default categoriesController;
