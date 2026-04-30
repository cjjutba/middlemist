'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Briefcase, Search, Users } from 'lucide-react';
import { type SearchResults, searchAll } from '@/actions/search';

const DEBOUNCE_MS = 150;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_RESULTS: SearchResults = { clients: [], projects: [] };

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  // Clear query when the palette closes. setState-in-effect is intentional
  // here — the only signal the palette has that it's been closed externally
  // (Cmd+K toggle, click-outside, Esc) is the `open` prop changing.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handle = setTimeout(async () => {
      if (inflight.current) inflight.current.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setLoading(true);
      try {
        const result = await searchAll({ q: query });
        if (ctrl.signal.aborted) return;
        if (result.ok) setResults(result.data);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('search failed', err);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, open]);

  const onSelectClient = useCallback(
    (id: string) => {
      onOpenChange(false);
      router.push(`/clients/${id}`);
    },
    [onOpenChange, router],
  );

  const onSelectProject = useCallback(
    (id: string) => {
      onOpenChange(false);
      router.push(`/projects/${id}`);
    },
    [onOpenChange, router],
  );

  const isEmpty = useMemo(
    () => results.clients.length === 0 && results.projects.length === 0,
    [results],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="bg-surface-dark/40 absolute inset-0"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="border-hairline bg-canvas relative w-full max-w-[640px] overflow-hidden rounded-lg border shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      >
        <Command label="Command palette" shouldFilter={false}>
          <div className="border-hairline-soft flex items-center gap-2 border-b px-4 py-3">
            <Search className="text-muted h-4 w-4" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search clients and projects…"
              className="text-ink placeholder:text-muted-soft h-7 flex-1 bg-transparent text-[15px] focus:outline-none"
            />
            <kbd className="border-hairline-soft bg-surface-soft text-muted-soft rounded-sm border px-1.5 py-0.5 text-[11px] font-medium">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[320px] overflow-y-auto py-2">
            {loading ? <div className="text-muted px-4 py-3 text-[13px]">Searching…</div> : null}

            {!loading && isEmpty ? (
              <Command.Empty className="text-muted px-4 py-8 text-center text-[14px]">
                {query ? 'Nothing matched.' : 'Start typing to search.'}
              </Command.Empty>
            ) : null}

            {results.clients.length > 0 ? (
              <Command.Group
                heading="Clients"
                className="[&_[cmdk-group-heading]]:text-muted-soft px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
              >
                {results.clients.map((c) => (
                  <Command.Item
                    key={`client-${c.id}`}
                    value={`client-${c.id}-${c.name}`}
                    onSelect={() => onSelectClient(c.id)}
                    className="aria-selected:bg-surface-soft flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Users className="text-muted h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-[14px] font-medium">{c.name}</p>
                      {c.subtitle ? (
                        <p className="text-muted truncate text-[12px]">{c.subtitle}</p>
                      ) : null}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {results.projects.length > 0 ? (
              <Command.Group
                heading="Projects"
                className="[&_[cmdk-group-heading]]:text-muted-soft px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
              >
                {results.projects.map((p) => (
                  <Command.Item
                    key={`project-${p.id}`}
                    value={`project-${p.id}-${p.name}`}
                    onSelect={() => onSelectProject(p.id)}
                    className="aria-selected:bg-surface-soft flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
                  >
                    <Briefcase className="text-muted h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate text-[14px] font-medium">{p.name}</p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>

          <div className="border-hairline-soft bg-surface-soft flex items-center justify-end gap-3 border-t px-4 py-2">
            <span className="text-muted-soft flex items-center gap-1 text-[11px]">
              <kbd className="border-hairline bg-canvas text-muted rounded-sm border px-1.5 py-0.5 font-medium">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="text-muted-soft flex items-center gap-1 text-[11px]">
              <kbd className="border-hairline bg-canvas text-muted rounded-sm border px-1.5 py-0.5 font-medium">
                ↵
              </kbd>
              Open
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
