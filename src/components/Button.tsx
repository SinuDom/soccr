import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ice';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Optional leading icon rendered before the label. */
  icon?: IconName;
  /** Optional trailing icon rendered after the label. */
  iconRight?: IconName;
  /** Render a square, icon-only button (children become the accessible label). */
  iconOnly?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-pitch-500 hover:bg-pitch-400 active:bg-pitch-600 text-ink-950 shadow-glow',
  secondary: 'bg-ink-700 hover:bg-ink-600 text-white border border-ink-600',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  ghost: 'bg-transparent hover:bg-ink-800 text-white',
  ice: 'bg-ice-500 hover:bg-ice-400 text-ink-950',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm gap-1.5 rounded-xl',
  md: 'h-12 px-5 text-base gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-lg gap-2.5 rounded-2xl',
  xl: 'h-16 px-8 text-xl gap-3 rounded-2xl',
};

const iconOnlySizes: Record<Size, string> = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-12 w-12 rounded-2xl',
  lg: 'h-14 w-14 rounded-2xl',
  xl: 'h-16 w-16 rounded-2xl',
};

const iconPx: Record<Size, number> = { sm: 16, md: 18, lg: 20, xl: 22 };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    icon,
    iconRight,
    iconOnly,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const px = iconPx[size];
  const label: ReactNode = iconOnly ? (
    icon ? <Icon name={icon} size={px} /> : children
  ) : (
    <>
      {icon && <Icon name={icon} size={px} />}
      {children}
      {iconRight && <Icon name={iconRight} size={px} />}
    </>
  );

  return (
    <button
      ref={ref}
      aria-label={iconOnly && typeof children === 'string' ? children : rest['aria-label']}
      className={[
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-[transform,background-color,box-shadow] duration-150 ease-out',
        'active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        variants[variant],
        iconOnly ? iconOnlySizes[size] : sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {label}
    </button>
  );
});
