'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PERMISSIONS, type Attendance } from '@dondy-elevage/shared-types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { Can } from '@/components/shared/permission-gate';
import { cn } from '@/lib/utils';
import { useEmployeeAttendance } from '../hooks';
import { attendanceStatusLabels } from '../schemas';
import { buildMonthGrid, weekdayLabels } from '../attendance-calendar-grid';
import { AttendanceDialog } from './attendance-dialog';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const statusTone: Record<Attendance['status'], Tone> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  CONGE: 'info',
  MALADIE: 'warning',
};

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Planning mensuel (« vue calendrier des présences/absences », Lot 6b) —
 * onglet Présence de la fiche employé. Un seul appel réseau (findAll,
 * historique complet de l'employé) : le mois affiché filtre côté client,
 * même ordre de grandeur que le reste de la fiche (Relevés/Suivi
 * quotidien ailleurs dans l'app ne paginent pas non plus l'historique). */
export function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getUTCMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: records, isLoading } = useEmployeeAttendance(employeeId);
  const byDate = useMemo(
    () => new Map((records ?? []).map((r) => [r.date.slice(0, 10), r])),
    [records],
  );
  const grid = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);

  function goToPreviousMonth() {
    if (monthIndex === 0) {
      setYear(year - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex(monthIndex - 1);
    }
  }

  function goToNextMonth() {
    if (monthIndex === 11) {
      setYear(year + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex(monthIndex + 1);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const selectedRecord = selectedDate ? (byDate.get(selectedDate) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="font-heading text-sm font-semibold capitalize text-primary">
          {monthLabel(year, monthIndex)}
        </p>
        <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((iso, index) => {
          if (!iso) return <div key={`empty-${index}`} />;
          const record = byDate.get(iso);
          const day = Number(iso.slice(8, 10));
          // Créer un jour vierge exige ATTENDANCE_CREATE, corriger un jour
          // déjà saisi exige ATTENDANCE_UPDATE — les 3 rôles avec accès en
          // écriture (Propriétaire/Administrateur, Gérant, Responsable
          // élevage) ont toujours les deux ensemble aujourd'hui, mais la
          // bonne permission est vérifiée au cas par cas plutôt que par
          // proxy (voir DETTE_TECHNIQUE.md Lot 6b).
          const writePermission = record ? PERMISSIONS.ATTENDANCE_UPDATE : PERMISSIONS.ATTENDANCE_CREATE;
          const dayNumber = <span>{day}</span>;
          const badge = record ? (
            <StatusBadge
              label={attendanceStatusLabels[record.status]}
              tone={statusTone[record.status]}
              className="text-[10px]"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          );

          return (
            <Can
              key={iso}
              permission={writePermission}
              fallback={
                <div className="flex flex-col items-center gap-1 rounded-md border border-transparent p-1.5 text-sm">
                  {dayNumber}
                  {badge}
                </div>
              }
            >
              <button
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border border-border p-1.5 text-sm transition-colors hover:border-primary',
                )}
              >
                {dayNumber}
                {badge}
              </button>
            </Can>
          );
        })}
      </div>

      {selectedDate ? (
        <AttendanceDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedDate(null);
          }}
          employeeId={employeeId}
          date={selectedDate}
          existing={selectedRecord}
        />
      ) : null}
    </div>
  );
}
