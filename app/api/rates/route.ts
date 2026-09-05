import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rates = await prisma.rate.findMany({
    orderBy: [{ group: "asc" }, { hourlyRate: "asc" }],
  });
  return NextResponse.json(rates);
}
