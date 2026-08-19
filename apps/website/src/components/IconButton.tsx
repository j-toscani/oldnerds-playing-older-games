import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { buttonVariants, type ButtonVariant } from './button-variants';

const iconButtonVariants = cva('!p-0 aspect-square', {
	variants: {
		size: {
			sm: 'w-7 h-7',
			md: 'w-9 h-9',
			lg: 'w-11 h-11',
		},
	},
	defaultVariants: {
		size: 'sm',
	},
});

// Derived from the CVA config above instead of a hand-written union.
type IconButtonSize = NonNullable<VariantProps<typeof iconButtonVariants>['size']>;

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: IconButtonSize;
	label: string;
	children: ReactNode;
}

export function IconButton({
	variant = 'ghost',
	size = 'sm',
	label,
	className = '',
	children,
	...props
}: IconButtonProps) {
	return (
		<button
			className={`${buttonVariants({ variant, size })} ${iconButtonVariants({ size })} ${className}`}
			aria-label={label}
			{...props}
		>
			{children}
		</button>
	);
}
