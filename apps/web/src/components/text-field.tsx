import { type ComponentPropsWithRef, useId } from 'react';
import clsx from 'clsx';

type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'className' | 'id'> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, ...props }: TextFieldProps) {
  const id = useId();
  const message = error ?? hint;
  const messageId = message ? `${id}-message` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={clsx(
          'h-11 rounded-xl border bg-background px-3.5 text-sm transition-colors',
          'placeholder:text-muted',
          'focus:ring-2 focus:outline-none',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-border focus:border-brand focus:ring-brand/30',
        )}
        {...props}
      />
      {message ? (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={clsx('text-xs', error ? 'text-danger' : 'text-muted')}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
