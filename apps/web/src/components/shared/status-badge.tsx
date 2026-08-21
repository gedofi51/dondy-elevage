import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const toneClasses: Record<Tone, string> = {
  default: 'border-border text-foreground',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-info/30 bg-info/10 text-info',
  muted: 'border-border bg-muted text-muted-foreground',
};

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

/** Badge générique enum → ton. Composer un `Record<TonEnum, Tone>` par
 * domaine (voir alert-badge.tsx pour l'exemple AlertSeverity) plutôt que
 * de dupliquer ce composant. */
export function StatusBadge({ label, tone = 'default', className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      {label}
    </Badge>
  );
}
