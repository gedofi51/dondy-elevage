'use client';

import { useState } from 'react';
import { PERMISSIONS } from '@dondy-elevage/shared-types';
import { PageHeader } from '@/components/shared/page-header';
import { Can } from '@/components/shared/permission-gate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AttendanceRegister } from '@/features/employees/components/attendance-register';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PointagePage() {
  const [date, setDate] = useState(todayIsoDate);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pointage"
        description="Registre de présence quotidien — arrivée et départ par employé."
      />

      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="pointage-date">Date</Label>
        <Input
          id="pointage-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Défense en profondeur : l'entrée de nav « Pointage » est gated par
          ATTENDANCE_READ OU EMPLOYEE_TASKS_READ (voir nav-items.ts) — les
          deux sont toujours accordées ensemble dans la matrice RBAC
          actuelle, mais un futur rôle avec EMPLOYEE_TASKS_READ seul (sans
          ATTENDANCE_READ) ne doit jamais atterrir sur un registre vide sans
          explication. */}
      <Can
        permission={PERMISSIONS.ATTENDANCE_READ}
        fallback={<p className="text-sm text-muted-foreground">Accès non autorisé à cette page.</p>}
      >
        <AttendanceRegister date={date} />
      </Can>
    </div>
  );
}
