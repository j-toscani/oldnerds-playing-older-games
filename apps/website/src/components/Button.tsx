import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonVariants, type ButtonVariant, type ButtonSize } from './button-variants';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	children: ReactNode;
}

export function Button({
	variant = 'secondary',
	size = 'md',
	className = '',
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={buttonVariants({ variant, size, className })}
			{...props}
		>
			{children}
		</button>
	);
}
