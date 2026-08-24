import { z } from 'zod';

export const expenseEntityTypeOptions = [
  'AUCUN',
  'CHAIR',
  'PONDEUSES',
  'POUSSINS',
  'REPRODUCTEURS',
  'COUVOIR',
  'EAU',
] as const;
export type ExpenseEntityType = (typeof expenseEntityTypeOptions)[number];

const expenseBaseFields = {
  date: z.string().min(1, 'Date requise'),
  category: z.string().min(1, 'Catégorie requise').max(191),
  description: z.string().max(2000).optional().or(z.literal('')),
  quantity: z.coerce.number().min(0).optional(),
  unitPriceFcfa: z.coerce.number().int('Nombre entier').min(0).optional(),
  amountFcfa: z.coerce.number().int('Nombre entier').min(0, 'Doit être positif'),
  supplierId: z.string().optional().or(z.literal('')),
  // Champs internes au formulaire, jamais envoyés tels quels : `entityType`
  // pilote quel FK ci-dessous est réellement soumis (voir ExpenseForm).
  entityType: z.enum(expenseEntityTypeOptions),
  entityId: z.string().optional().or(z.literal('')),
};

export const createExpenseSchema = z.object(expenseBaseFields);
export type CreateExpenseFormInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseFormValues = z.output<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object(expenseBaseFields);
export type UpdateExpenseFormInput = z.input<typeof updateExpenseSchema>;
export type UpdateExpenseFormValues = z.output<typeof updateExpenseSchema>;
