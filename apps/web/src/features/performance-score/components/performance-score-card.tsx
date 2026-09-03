'use client';

import type { BatchPerformanceScore } from '@dondy-elevage/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatNumber(value: number | null, unit: string): string {
  if (value === null) return '—';
  const formatted = value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`;
}

/**
 * Score de performance (Lot 5) — décomposition explicite obligatoire :
 * jamais un score seul, toujours accompagné du détail par composante
 * (valeur brute, cible, poids, contribution) côte à côte dans un tableau —
 * même principe de transparence que la décomposition des anomalies au Lot
 * 4 (`Alert.message`), adapté ici au format numérique (voir
 * DETTE_TECHNIQUE.md Lot 5, point 6). `dataStatus: 'INSUFFISANT'` rendu
 * explicitement (jamais un score inventé), même convention que
 * `StockForecastWidget`/`ItemForecast` (Lot 2).
 */
export function PerformanceScoreCard({ score }: { score: BatchPerformanceScore }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Score de performance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          {score.dataStatus === 'SUFFISANT' && score.scoreOn100 !== null ? (
            <>
              <span className="text-3xl font-semibold text-foreground">
                {score.scoreOn100.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pas encore assez de données pour calculer un score.
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Composante</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Poids</TableHead>
                <TableHead>Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {score.components.map((component) => (
                <TableRow key={component.key}>
                  <TableCell className="font-medium text-foreground">{component.label}</TableCell>
                  <TableCell>{formatNumber(component.rawValue, component.unit)}</TableCell>
                  <TableCell>
                    {component.target !== null ? formatNumber(component.target, component.unit) : '—'}
                  </TableCell>
                  <TableCell>{formatPercent(component.weight * 100)}</TableCell>
                  <TableCell>{formatPercent(component.contributionPercent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Calculé le {new Date(score.calculatedAt).toLocaleString('fr-FR')}
        </p>
      </CardContent>
    </Card>
  );
}
