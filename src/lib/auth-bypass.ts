import prisma from "@/lib/prisma";

/**
 * Temporary auth bypass — returns the admin user as the session.
 * Replace with real auth() when enabling authentication.
 */
export async function auth() {
  // Find the admin user to use as default
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!admin) {
    // Fallback if no admin exists
    return {
      user: {
        id: "system",
        name: "Admin",
        email: "admin@pauldavis-pbctc.com",
        role: "ADMIN" as const,
      },
    };
  }

  return {
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
}
