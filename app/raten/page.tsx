import { prisma } from "@/lib/prisma";
import { toRateDTO } from "@/lib/rates";
import { RatesManager } from "@/components/RatesManager";

export const dynamic = "force-dynamic";

export default async function RatenPage() {
  const rates = await prisma.rate.findMany({
    orderBy: [{ group: "asc" }, { hourlyRate: "asc" }],
  });

  return <RatesManager initialRates={rates.map(toRateDTO)} />;
}
