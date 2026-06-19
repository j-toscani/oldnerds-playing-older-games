import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
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

type IconButtonSize = 'sm' | 'md' | 'lg';

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
