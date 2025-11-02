import bcrypt from "bcrypt";
import localStrategy from "passport-local";
import { PassportStatic } from "passport";
import prisma from "./utils/prisma";

// Helper function to transform user data to match Express.User interface
const transformUserForSession = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      workspaceMembers: {
        select: {
          role: true,
          lastActive: true,
          workspace: {
            select: {
              id: true,
              name: true,
              description: true,
              subscription: {
                select: {
                  plan: true,
                  status: true,
                  currentPeriodEnd: true,
                  cancelAtPeriodEnd: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const workspaces = user.workspaceMembers.map((member) => ({
    id: member.workspace.id,
    name: member.workspace.name,
    description: member.workspace.description,
    role: member.role,
    lastActive: member.lastActive,
    subscription: member.workspace.subscription,
  }));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    joined: user.createdAt,
    updatedAt: user.updatedAt,
    workspaces,
  };
};

const configurePassport = (passport: PassportStatic) => {
  passport.use(
    new localStrategy.Strategy(
      { usernameField: "email" },
      async (email: string, password: string, done) => {
        try {
          if (password == null || password === "") {
            return done(null, false, { message: "Password is required." });
          }

          // Find user by email
          const user = await prisma.user.findFirst({
            where: { email: email },
          });

          if (!user) {
            return done(null, false, {
              message: "Incorrect username or password.",
            });
          }

          if (user.password == null || user.password === "") {
            return done(null, false, {
              message: "Please set a password for your account.",
            });
          }

          const passwordMatch = await bcrypt.compare(password, user.password);
          if (!passwordMatch) {
            return done(null, false, {
              message: "Incorrect username or password.",
            });
          }

          // Update last active timestamp for all workspaces
          await prisma.workspaceMember.updateMany({
            where: { userId: user.id },
            data: { lastActive: new Date() },
          });

          // Transform to match Express.User interface
          const userInfo = await transformUserForSession(user.id);
          if (!userInfo) {
            return done(null, false, {
              message: "Error loading user data.",
            });
          }

          return done(null, userInfo);
        } catch (err) {
          console.error("Passport authentication error:", err);
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const userInfo = await transformUserForSession(id);

      if (!userInfo) {
        return done(null, false);
      }

      done(null, userInfo);
    } catch (err) {
      console.error("Passport deserialization error:", err);
      done(err as Error);
    }
  });
};

export default configurePassport;
export { transformUserForSession };
