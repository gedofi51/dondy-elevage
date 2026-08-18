import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';
import { AppTopbar } from './app-topbar';
import { AppBottomNav } from './app-bottom-nav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />

      <div className="flex min-h-screen flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      <AppBottomNav />
    </div>
  );
}
