import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RateGroup } from "@prisma/client";

export async function GET() {
  const rates = await prisma.rate.findMany({
    orderBy: [{ group: "asc" }, { hourlyRate: "asc" }],
  });
  return NextResponse.json(rates);
}

const VALID_GROUPS: RateGroup[] = ["BEAMTE", "TARIF", "EXTERN"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, hourlyRate, group } = body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }
  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "Stundensatz muss eine positive Zahl sein." }, { status: 400 });
  }
  const resolvedGroup: RateGroup = VALID_GROUPS.includes(group) ? group : "EXTERN";

  const created = await prisma.rate.create({
    data: {
      name: name.trim(),
      hourlyRate: rate,
      group: resolvedGroup,
      source: null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
