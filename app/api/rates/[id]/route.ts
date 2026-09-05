import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, hourlyRate } = body ?? {};

  const data: Prisma.RateUpdateInput = {};
  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
  }
  if (hourlyRate !== undefined) {
    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: "Stundensatz muss eine positive Zahl sein." }, { status: 400 });
    }
    data.hourlyRate = rate;
  }

  try {
    const updated = await prisma.rate.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Satz nicht gefunden." }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Satz nicht gefunden." }, { status: 404 });
  }
  if (existing.source) {
    return NextResponse.json(
      { error: "Offizielle BMF-Sätze können nicht gelöscht werden." },
      { status: 403 }
    );
  }

  await prisma.rate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
