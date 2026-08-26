import { z } from 'zod';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export { todayIsoDate };

export const createWaterInfrastructureReadingSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  pumpedVolumeM3: z.coerce.number().min(0).optional(),
  reservoirLevelPercent: z.coerce.number().min(0).max(100).optional(),
  pumpHoursCumulative: z.coerce.number().min(0).optional(),
  farmInternalConsumptionM3: z.coerce.number().min(0).optional(),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateWaterInfrastructureReadingFormInput = z.input<
  typeof createWaterInfrastructureReadingSchema
>;
export type CreateWaterInfrastructureReadingFormValues = z.output<
  typeof createWaterInfrastructureReadingSchema
>;

export const createSolarInfrastructureReadingSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  dailyProductionKwh: z.coerce.number().min(0).optional(),
  batteryChargePercent: z.coerce.number().min(0).max(100).optional(),
  instantaneousPowerKw: z.coerce.number().min(0).optional(),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateSolarInfrastructureReadingFormInput = z.input<
  typeof createSolarInfrastructureReadingSchema
>;
export type CreateSolarInfrastructureReadingFormValues = z.output<
  typeof createSolarInfrastructureReadingSchema
>;

export const networkOperationalStatusOptions = ['OPERATIONNEL', 'DEGRADE', 'HORS_LIGNE'] as const;
export const networkOperationalStatusLabels: Record<
  (typeof networkOperationalStatusOptions)[number],
  string
> = {
  OPERATIONNEL: 'Opérationnel',
  DEGRADE: 'Dégradé',
  HORS_LIGNE: 'Hors ligne',
};

export const createNetworkStatusReadingSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  operationalStatus: z.enum(networkOperationalStatusOptions),
  observations: z.string().max(2000).optional().or(z.literal('')),
});
export type CreateNetworkStatusReadingFormInput = z.input<typeof createNetworkStatusReadingSchema>;
export type CreateNetworkStatusReadingFormValues = z.output<typeof createNetworkStatusReadingSchema>;
