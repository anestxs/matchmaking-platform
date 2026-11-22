import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-hover',
  secondary: 'border border-border bg-surface hover:border-brand hover:bg-surface-hover',
};

export function buttonClasses(variant: Variant = 'primary') {
  return clsx(
    'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: Variant;
};

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  return <button className={buttonClasses(variant)} {...props} />;
}
