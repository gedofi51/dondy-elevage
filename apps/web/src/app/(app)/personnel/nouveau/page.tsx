import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '@/features/employees/components/employee-form';

export default function NewEmployeePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvel employé" />
      <div className="max-w-2xl">
        <EmployeeForm />
      </div>
    </div>
  );
}
