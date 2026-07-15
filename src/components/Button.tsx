import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ice';
type Size = 'md' | 'lg' | 'xl';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-pitch-500 hover:bg-pitch-400 active:bg-pitch-600 text-ink-950 shadow-glow',
  secondary: 'bg-ink-700 hover:bg-ink-600 text-white border border-ink-600',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  ghost: 'bg-transparent hover:bg-ink-800 text-white',
  ice: 'bg-ice-500 hover:bg-ice-400 text-ink-950',
};

const sizes: Record<Size, string> = {
  md: 'h-12 px-5 text-base',
  lg: 'h-16 px-6 text-lg',
  xl: 'h-24 px-8 text-2xl',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        'rounded-2xl font-semibold transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-pitch-400',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
});
