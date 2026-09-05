'use client';

import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '@/features/users/components/user-form';
import { useUser } from '@/features/users/hooks';

export function EditUserView({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUser(userId);

  if (isLoading || !user) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Modifier — ${user.name}`} />
      <div className="max-w-2xl">
        <UserForm user={user} />
      </div>
    </div>
  );
}
