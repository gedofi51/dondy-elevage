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
}

export function KpiCard({ label, value, unit, tone = 'default', icon: Icon }: KpiCardProps) {
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
      </CardContent>
    </Card>
  );
}
