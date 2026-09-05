import { Rate as PrismaRate } from "@prisma/client";
import { Rate } from "./timer";

export function toRateDTO(rate: PrismaRate): Rate {
  return {
    id: rate.id,
    name: rate.name,
    hourlyRate: Number(rate.hourlyRate),
    group: rate.group,
    source: rate.source,
  };
}

export const GROUP_LABELS: Record<Rate["group"], string> = {
  BEAMTE: "Beamte",
  TARIF: "Tarifbeschäftigte",
  EXTERN: "Extern (Dienstleister, Berater)",
};
