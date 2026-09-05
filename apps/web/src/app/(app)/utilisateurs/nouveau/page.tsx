import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '@/features/users/components/user-form';

export default function NewUserPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvel utilisateur" description="Invite un nouvel utilisateur sur votre ferme." />
      <UserForm />
    </div>
  );
}
