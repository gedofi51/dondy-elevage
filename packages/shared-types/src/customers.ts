export type CustomerType =
  | 'PARTICULIER'
  | 'COMMERCANT'
  | 'RESTAURANT'
  | 'REVENDEUR'
  | 'ENTREPRISE'
  | 'AUTRE';

export interface Customer {
  id: string;
  farmId: string;
  code: string;
  name: string;
  phone: string | null;
  locality: string | null;
  address: string | null;
  type: CustomerType;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}
