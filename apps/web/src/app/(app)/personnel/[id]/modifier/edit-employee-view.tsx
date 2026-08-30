'use client';

import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '@/features/employees/components/employee-form';
import { useEmployee } from '@/features/employees/hooks';

export function EditEmployeeView({ employeeId }: { employeeId: string }) {
  const { data: employee, isLoading } = useEmployee(employeeId);

  if (isLoading || !employee) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${employee.code}`} />
      <div className="max-w-2xl">
        <EmployeeForm employee={employee} />
      </div>
    </div>
  );
}
