import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils.ts';

export const labelStyles = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelStyles> {}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(
  ({ className, ...props }, ref): React.JSX.Element => {
    return (
      <LabelPrimitive.Root
        ref={ref}
        className={cn(labelStyles(), className)}
        {...props}
      />
    );
  }
);

Label.displayName = LabelPrimitive.Root.displayName;
