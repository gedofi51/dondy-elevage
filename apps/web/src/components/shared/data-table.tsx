import type { ReactNode } from 'react';
import type { PaginatedResult } from '@dondy-elevage/shared-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** Tableau simple (la plupart des listes de ce backend) ou enveloppe
   * PaginatedResult<T> (Alerts/Notifications, seuls endpoints réellement
   * paginés) — voir packages/shared-types/src/pagination.ts. */
  data: T[] | PaginatedResult<T> | undefined;
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  emptyLabel?: string;
  rowActions?: (row: T) => ReactNode;
}

function toRows<T>(data: T[] | PaginatedResult<T> | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading,
  emptyLabel = 'Aucun résultat.',
  rowActions,
}: DataTableProps<T>) {
  const rows = toRows(data);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
            {rowActions ? <TableHead className="w-0" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (rowActions ? 1 : 0)}>
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (rowActions ? 1 : 0)}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
                {rowActions ? (
                  <TableCell className="text-right">{rowActions(row)}</TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
