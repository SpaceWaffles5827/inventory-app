import { Request, Response } from "express";
import prisma from "../utils/prisma";

const customersController = {
  // Create a new customer
  createCustomer: async (req: Request, res: Response) => {
    try {
      const {
        name,
        contactPerson,
        email,
        phone,
        address,
        company,
        status,
        workspaceId,
      } = req.body;
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
          message: "Customer name is required",
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

      // Check if customer name already exists in this workspace
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          workspaceId: workspaceId,
          name: name.trim(),
        },
      });

      if (existingCustomer) {
        return res.status(400).json({
          status: "error",
          message: "Customer name already exists in this workspace",
        });
      }

      // Validate email format if provided
      if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({
            status: "error",
            message: "Invalid email format",
          });
        }
      }

      // Create the customer
      const customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          contactPerson: contactPerson?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          company: company?.trim() || name.trim(),
          status: status || "ACTIVE",
          workspaceId: workspaceId,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Customer created successfully",
        data: { customer },
      });
    } catch (error) {
      console.error("Create customer error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create customer",
      });
    }
  },

  // Get all customers in a workspace
  getCustomers: async (req: Request, res: Response) => {
    try {
      const { workspaceId, status, search } = req.query;
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

      // Build filter conditions
      const whereConditions: any = {
        workspaceId: workspaceId as string,
      };

      if (status) {
        whereConditions.status = status;
      }

      if (search) {
        whereConditions.OR = [
          { name: { contains: search as string } },
          { contactPerson: { contains: search as string } },
          { email: { contains: search as string } },
          { company: { contains: search as string } },
        ];
      }

      // Get all customers in the workspace
      const customers = await prisma.customer.findMany({
        where: whereConditions,
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { customers },
      });
    } catch (error) {
      console.error("Get customers error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve customers",
      });
    }
  },

  // Get a single customer by ID
  getCustomerById: async (req: Request, res: Response) => {
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

      // Get the customer
      const customer = await prisma.customer.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  itemNumber: true,
                  name: true,
                  onHand: true,
                  status: true,
                  cost: true,
                },
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({
          status: "error",
          message: "Customer not found",
        });
      }

      return res.status(200).json({
        status: "success",
        data: { customer },
      });
    } catch (error) {
      console.error("Get customer by ID error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve customer",
      });
    }
  },

  // Update a customer
  updateCustomer: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        contactPerson,
        email,
        phone,
        address,
        company,
        status,
        orderCount,
        totalSpent,
        workspaceId,
      } = req.body;
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

      // Check if customer exists in this workspace
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId,
        },
      });

      if (!existingCustomer) {
        return res.status(404).json({
          status: "error",
          message: "Customer not found",
        });
      }

      // If name is being updated, check for duplicates
      if (name && name.trim() !== existingCustomer.name) {
        const duplicateCustomer = await prisma.customer.findFirst({
          where: {
            workspaceId: workspaceId,
            name: name.trim(),
            id: { not: id },
          },
        });

        if (duplicateCustomer) {
          return res.status(400).json({
            status: "error",
            message: "Customer name already exists in this workspace",
          });
        }
      }

      // Validate email format if provided
      if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({
            status: "error",
            message: "Invalid email format",
          });
        }
      }

      // Update the customer
      const customer = await prisma.customer.update({
        where: { id: id },
        data: {
          ...(name && { name: name.trim() }),
          ...(contactPerson !== undefined && {
            contactPerson: contactPerson?.trim() || null,
          }),
          ...(email !== undefined && { email: email?.trim() || null }),
          ...(phone !== undefined && { phone: phone?.trim() || null }),
          ...(address !== undefined && { address: address?.trim() || null }),
          ...(company !== undefined && {
            company: company?.trim() || name?.trim() || existingCustomer.name,
          }),
          ...(status !== undefined && { status }),
          ...(orderCount !== undefined && { orderCount }),
          ...(totalSpent !== undefined && { totalSpent }),
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Customer updated successfully",
        data: { customer },
      });
    } catch (error) {
      console.error("Update customer error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update customer",
      });
    }
  },

  // Delete a customer
  deleteCustomer: async (req: Request, res: Response) => {
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

      // Check if customer exists in this workspace
      const customer = await prisma.customer.findFirst({
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

      if (!customer) {
        return res.status(404).json({
          status: "error",
          message: "Customer not found",
        });
      }

      // Check if customer has items
      if (customer._count.items > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot delete customer with ${customer._count.items} associated item(s). Please remove the associations first.`,
        });
      }

      // Delete the customer
      await prisma.customer.delete({
        where: { id: id },
      });

      return res.status(200).json({
        status: "success",
        message: "Customer deleted successfully",
      });
    } catch (error) {
      console.error("Delete customer error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete customer",
      });
    }
  },

  // Attach item to customer
  attachItemToCustomer: async (req: Request, res: Response) => {
    try {
      const { customerId, itemId, quantity, notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!customerId || !itemId) {
        return res.status(400).json({
          status: "error",
          message: "Customer ID and Item ID are required",
        });
      }

      // Verify customer exists and get workspace
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { workspaceId: true },
      });

      if (!customer) {
        return res.status(404).json({
          status: "error",
          message: "Customer not found",
        });
      }

      // Verify item exists and belongs to same workspace
      const item = await prisma.item.findFirst({
        where: {
          id: itemId,
          workspaceId: customer.workspaceId,
        },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found in this workspace",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: customer.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if association already exists
      const existingAssociation = await prisma.itemCustomer.findUnique({
        where: {
          itemId_customerId: {
            itemId: itemId,
            customerId: customerId,
          },
        },
      });

      if (existingAssociation) {
        // Update existing association
        const updated = await prisma.itemCustomer.update({
          where: {
            itemId_customerId: {
              itemId: itemId,
              customerId: customerId,
            },
          },
          data: {
            quantity: quantity || existingAssociation.quantity,
            notes: notes !== undefined ? notes : existingAssociation.notes,
            lastOrderDate: new Date(),
          },
          include: {
            item: true,
            customer: true,
          },
        });

        return res.status(200).json({
          status: "success",
          message: "Item-customer association updated successfully",
          data: { itemCustomer: updated },
        });
      }

      // Create new association
      const itemCustomer = await prisma.itemCustomer.create({
        data: {
          itemId: itemId,
          customerId: customerId,
          quantity: quantity || 0,
          notes: notes || null,
          lastOrderDate: new Date(),
        },
        include: {
          item: true,
          customer: true,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Item attached to customer successfully",
        data: { itemCustomer },
      });
    } catch (error) {
      console.error("Attach item to customer error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to attach item to customer",
      });
    }
  },

  // Detach item from customer
  detachItemFromCustomer: async (req: Request, res: Response) => {
    try {
      const { customerId, itemId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      // Verify customer exists and get workspace
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { workspaceId: true },
      });

      if (!customer) {
        return res.status(404).json({
          status: "error",
          message: "Customer not found",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: customer.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if association exists
      const association = await prisma.itemCustomer.findUnique({
        where: {
          itemId_customerId: {
            itemId: itemId,
            customerId: customerId,
          },
        },
      });

      if (!association) {
        return res.status(404).json({
          status: "error",
          message: "Item-customer association not found",
        });
      }

      // Delete the association
      await prisma.itemCustomer.delete({
        where: {
          itemId_customerId: {
            itemId: itemId,
            customerId: customerId,
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Item detached from customer successfully",
      });
    } catch (error) {
      console.error("Detach item from customer error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to detach item from customer",
      });
    }
  },

  // Get customer statistics
  getCustomerStats: async (req: Request, res: Response) => {
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

      // Get customer statistics
      const totalCustomers = await prisma.customer.count({
        where: { workspaceId: workspaceId as string },
      });

      const activeCustomers = await prisma.customer.count({
        where: {
          workspaceId: workspaceId as string,
          status: "ACTIVE",
        },
      });

      const customers = await prisma.customer.findMany({
        where: { workspaceId: workspaceId as string },
        select: {
          orderCount: true,
          totalSpent: true,
        },
      });

      const totalOrders = customers.reduce(
        (sum, customer) => sum + customer.orderCount,
        0
      );

      const totalRevenue = customers.reduce(
        (sum, customer) => sum + customer.totalSpent,
        0
      );

      return res.status(200).json({
        status: "success",
        data: {
          totalCustomers,
          activeCustomers,
          inactiveCustomers: totalCustomers - activeCustomers,
          totalOrders,
          totalRevenue,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
      });
    } catch (error) {
      console.error("Get customer stats error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve customer statistics",
      });
    }
  },
};

export default customersController;
