import { z } from 'zod';

// Premier useFieldArray du frontend — lignes ajoutables/retirables
// librement, miroir de CreatePurchaseOrderDto.items (@ArrayMinSize(1)).
const purchaseOrderLineSchema = z.object({
  itemId: z.string().min(1, 'Article requis'),
  orderedQuantity: z.coerce.number().min(0.001, 'Doit être positif'),
  unitPriceFcfa: z.coerce.number().int('Nombre entier').min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Fournisseur requis'),
  date: z.string().min(1, 'Date requise'),
  dueDate: z.string().optional().or(z.literal('')),
  observation: z.string().max(2000).optional().or(z.literal('')),
  items: z.array(purchaseOrderLineSchema).min(1, 'Au moins une ligne requise'),
});
export type CreatePurchaseOrderFormInput = z.input<typeof createPurchaseOrderSchema>;
export type CreatePurchaseOrderFormValues = z.output<typeof createPurchaseOrderSchema>;

// Réception : nombre de lignes FIXE (une par ligne de la commande), pas de
// useFieldArray — un tableau statique pré-rempli par la vue appelante.
// Les lignes à 0 sont filtrées avant soumission (le serveur rejette une
// receivedQuantity=0, @Min(0.001)), donc la validation porte sur le
// tableau déjà filtré.
const goodsReceiptLineSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  receivedQuantity: z.coerce.number().min(0),
});

export const createGoodsReceiptSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  responsibleId: z.string().optional().or(z.literal('')),
  observation: z.string().max(2000).optional().or(z.literal('')),
  items: z.array(goodsReceiptLineSchema),
});
export type CreateGoodsReceiptFormInput = z.input<typeof createGoodsReceiptSchema>;
export type CreateGoodsReceiptFormValues = z.output<typeof createGoodsReceiptSchema>;
