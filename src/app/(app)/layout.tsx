import { AppSidebar } from '@/components/app/app-sidebar';
import { CommandPaletteProvider } from '@/components/app/command-palette-provider';
import { TopNav } from '@/components/app/top-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <div className="bg-canvas flex min-h-screen flex-col">
        <TopNav />
        <div className="flex flex-1">
          <AppSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
