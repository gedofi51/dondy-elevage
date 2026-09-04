import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type KpiTone = 'default' | 'success' | 'warning' | 'destructive' | 'info';

const toneClasses: Record<KpiTone, string> = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  tone?: KpiTone;
  icon?: LucideIcon;
  /** Carte "vedette" sur fond primary plein — `shadow-kpi-hero`, préparée
   * en Phase 10 ("réservée à une future carte KPI vedette") mais jamais
   * utilisée jusqu'ici. `tone` est ignoré en hero : la valeur reste
   * toujours `text-primary-foreground` (lisible sur fond plein), jamais
   * une des couleurs sémantiques normalement contrastées sur fond clair. */
  hero?: boolean;
  /** Ligne secondaire sous la valeur (ex. "+180 cette semaine", "2 j
   * d'autonomie") — distincte de `unit` (accolé à la valeur) : les deux
   * peuvent coexister, comme sur la maquette 1a (Lot Tableau de bord). */
  caption?: string;
  captionTone?: KpiTone;
}

const captionToneClasses: Record<KpiTone, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
};

export function KpiCard({
  label,
  value,
  unit,
  tone = 'default',
  icon: Icon,
  hero = false,
  caption,
  captionTone = 'default',
}: KpiCardProps) {
  if (hero) {
    return (
      <Card className="border-transparent bg-primary text-primary-foreground shadow-kpi-hero">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-primary-foreground/70">{label}</CardTitle>
          {Icon ? <Icon className="h-4 w-4 text-primary-foreground/70" aria-hidden="true" /> : null}
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-semibold">
            {value}
            {unit ? (
              <span className="ml-1 font-sans text-sm font-normal text-primary-foreground/70">{unit}</span>
            ) : null}
          </p>
          {caption ? <p className="mt-1.5 text-xs text-primary-foreground/70">{caption}</p> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-kpi">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className={cn('h-4 w-4', toneClasses[tone])} aria-hidden="true" /> : null}
      </CardHeader>
      <CardContent>
        <p className={cn('font-heading text-3xl font-semibold', toneClasses[tone])}>
          {value}
          {unit ? <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">{unit}</span> : null}
        </p>
        {caption ? <p className={cn('mt-1.5 text-xs', captionToneClasses[captionTone])}>{caption}</p> : null}
      </CardContent>
    </Card>
  );
}
