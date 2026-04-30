'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import {
  SELECTABLE_STATUSES,
  createProjectSchema,
  type CreateProjectInputZ,
} from '@/lib/schemas/project.schema';
import { SUPPORTED_CURRENCIES } from '@/lib/schemas/client.schema';
import { friendlyMessage } from '@/lib/utils/errors';
import { createProject, updateProject } from '@/actions/projects';

type ClientOption = { id: string; name: string };

type Mode =
  | { mode: 'create'; clients: ClientOption[]; defaults?: Partial<CreateProjectInputZ> }
  | {
      mode: 'edit';
      projectId: string;
      clients: ClientOption[];
      defaults: Partial<CreateProjectInputZ>;
    };

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};

export function ProjectForm(props: Mode) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInputZ>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: props.defaults ?? {},
  });

  function onSubmit(values: CreateProjectInputZ) {
    setServerError(null);
    startTransition(async () => {
      const result =
        props.mode === 'create'
          ? await createProject(values)
          : await updateProject({ id: props.projectId, ...values });
      if (!result.ok) {
        setServerError(friendlyMessage(result.error));
        return;
      }
      const targetId = props.mode === 'create' ? result.data.id : props.projectId;
      router.push(`/projects/${targetId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {props.mode === 'create' ? (
        <SelectField
          label="Client"
          error={errors.clientId?.message}
          {...register('clientId')}
          defaultValue={props.defaults?.clientId ?? ''}
        >
          <option value="">Pick a client…</option>
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <TextField
        label="Project name"
        placeholder="Q3 marketing site refresh"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextareaField
        label="Description"
        hint="What this project is about."
        rows={4}
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Status"
          hint="Defaults to Active"
          error={errors.status?.message}
          {...register('status')}
          defaultValue={props.defaults?.status ?? 'active'}
        >
          {SELECTABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Currency"
          error={errors.currency?.message}
          {...register('currency')}
          defaultValue={props.defaults?.currency ?? 'USD'}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Start date"
          type="date"
          hint="Optional"
          error={errors.startedAt?.message}
          {...register('startedAt')}
        />
        <TextField
          label="End date"
          type="date"
          hint="Optional"
          error={errors.endedAt?.message}
          {...register('endedAt')}
        />
      </div>
      <TextField
        label="Budget"
        type="number"
        step="0.01"
        hint="Optional. Currency above."
        error={errors.budgetAmount?.message}
        {...register('budgetAmount')}
      />

      {serverError ? (
        <p className="border-error/30 bg-error/10 text-error rounded-md border px-3 py-2 text-[13px]">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : props.mode === 'create' ? 'Create project' : 'Save changes'}
        </Button>
        <Button type="button" variant="text" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
