import * as React from 'react';
import { Input } from '../ui/Input.tsx';
import { Label } from '../ui/Label.tsx';
import { cn } from '../ui/utils.ts';

export type FieldProps = Omit<React.ComponentProps<typeof Input>, 'id'> & {
  id: string;
  label: string;
  description?: string;
  error?: string;
};

export const Field = ({
  id,
  label,
  description,
  error,
  className,
  ...inputProps
}: FieldProps): React.JSX.Element => {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
