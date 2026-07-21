import "server-only";

import { auth } from "@/app/(auth)/auth";

export async function getAuthenticatedUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

export async function getAdminUser() {
  const user = await getAuthenticatedUser();
  return user?.role === "ADMIN" ? user : null;
}
