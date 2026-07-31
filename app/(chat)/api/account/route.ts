import { compare, genSaltSync, hashSync } from "bcrypt-ts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { prisma } from "@/lib/prisma";

const updateNameSchema = z.object({
  name: z.string().max(100).optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(72),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Password change
    if (body.currentPassword || body.newPassword) {
      const { currentPassword, newPassword } = updatePasswordSchema.parse(body);

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      });

      if (!user?.password) {
        return NextResponse.json(
          { error: "This account has no password set." },
          { status: 400 },
        );
      }

      const valid = await compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 },
        );
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashSync(newPassword, genSaltSync(10)) },
      });

      return NextResponse.json({ passwordChanged: true });
    }

    // Name update
    const { name } = updateNameSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name ?? null },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update account" },
      { status: 400 },
    );
  }
}
