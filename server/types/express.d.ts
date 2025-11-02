// In your types file
import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
      joined: Date;
      updatedAt: Date;
      workspaces: {
        id: string;
        name: string;
        description: string | null;
        role: Role;
        lastActive: Date;
        subscription: {
          plan: string;
          status: string;
          currentPeriodEnd: Date;
          cancelAtPeriodEnd: boolean;
        } | null;
      }[];
    }
  }
}

export {};
