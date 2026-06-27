import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { sumLotsOnHand } from "../utils/onHand";

const categoriesController = {
  // Create a new category
  createCategory: async (req: Request, res: Response) => {
    try {
      const { name, description, workspaceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      if (!name || name.trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Category name is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if category name already exists in this workspace
      const existingCategory = await prisma.category.findFirst({
        where: {
          workspaceId: workspaceId,
          name: name.trim(),
        },
      });

      if (existingCategory) {
        return res.status(400).json({
          status: "error",
          message: "Category name already exists in this workspace",
        });
      }

      // Create the category
      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          workspaceId: workspaceId,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Create category error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create category",
      });
    }
  },

  // Get all categories in a workspace
  getCategories: async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Get all categories in the workspace
      const categories = await prisma.category.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      // Map the _count to itemCount for consistency with the schema
      const categoriesWithCount = categories.map((category) => ({
        ...category,
        itemCount: category._count.items,
        _count: undefined,
      }));

      return res.status(200).json({
        status: "success",
        data: { categories: categoriesWithCount },
      });
    } catch (error) {
      console.error("Get categories error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve categories",
      });
    }
  },

  // Get a single category by ID
  getCategoryById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Get the category
      const category = await prisma.category.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
          items: {
            select: {
              id: true,
              itemNumber: true,
              name: true,
              status: true,
              lots: {
                select: {
                  locations: {
                    select: { quantity: true },
                  },
                },
              },
            },
            orderBy: {
              name: "asc",
            },
          },
        },
      });

      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      // onHand is derived from lot locations, not a stored column
      const categoryWithOnHand = {
        ...category,
        items: category.items.map(({ lots, ...item }) => ({
          ...item,
          onHand: sumLotsOnHand(lots),
        })),
      };

      return res.status(200).json({
        status: "success",
        data: { category: categoryWithOnHand },
      });
    } catch (error) {
      console.error("Get category by ID error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve category",
      });
    }
  },

  // Update a category
  updateCategory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, workspaceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if category exists in this workspace
      const existingCategory = await prisma.category.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      // If name is being updated, check for duplicates
      if (name && name.trim() !== existingCategory.name) {
        const duplicateCategory = await prisma.category.findFirst({
          where: {
            workspaceId: workspaceId,
            name: name.trim(),
            id: { not: id },
          },
        });

        if (duplicateCategory) {
          return res.status(400).json({
            status: "error",
            message: "Category name already exists in this workspace",
          });
        }
      }

      // Update the category
      const category = await prisma.category.update({
        where: { id: id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && {
            description: description?.trim() || null,
          }),
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Category updated successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Update category error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update category",
      });
    }
  },

  // Delete a category
  deleteCategory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if category exists in this workspace
      const category = await prisma.category.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!category) {
        return res.status(404).json({
          status: "error",
          message: "Category not found",
        });
      }

      // Check if category has items
      if (category._count.items > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot delete category with ${category._count.items} item(s). Please reassign or delete the items first.`,
        });
      }

      // Delete the category
      await prisma.category.delete({
        where: { id: id },
      });

      return res.status(200).json({
        status: "success",
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Delete category error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete category",
      });
    }
  },
};

export default categoriesController;
