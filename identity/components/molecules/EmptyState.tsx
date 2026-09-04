import * as React from 'react';
import { Button } from '../ui/Button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card.tsx';
import { cn } from '../ui/utils.ts';

export type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps): React.JSX.Element => {
  return (
    <Card className={cn('max-w-md', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {actionLabel && onAction ? (
        <CardContent>
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
};
