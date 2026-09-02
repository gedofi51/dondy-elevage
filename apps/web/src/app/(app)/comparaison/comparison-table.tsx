'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface ComparisonColumn {
  key: string;
  label: string;
}

export interface ComparisonRow {
  key: string;
  label: string;
  /** Une valeur par colonne, dans le même ordre que `columns` — `'—'`
   * plutôt qu'une valeur inventée quand l'indicateur est indisponible
   * pour cette entité. */
  values: string[];
}

/**
 * Comparaison de bandes/couveuses (Lot 4) — tableau transposé (indicateur
 * en ligne, entité en colonne), contrairement à DataTable (entité en
 * ligne) : orientation naturelle pour comparer 2+ entités côte à côte,
 * même primitives `@/components/ui/table` pour rester visuellement
 * cohérent avec le reste de l'application.
 */
export function ComparisonTable({ columns, rows }: { columns: ComparisonColumn[]; rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Indicateur</TableHead>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-foreground">{row.label}</TableCell>
              {row.values.map((value, index) => (
                <TableCell key={columns[index]?.key ?? index}>{value}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
