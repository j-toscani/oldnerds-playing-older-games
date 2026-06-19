import type { PropsWithChildren } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { buttonVariants, type ButtonVariant, type ButtonSize } from './button-variants';

type ButtonLinkProps = PropsWithChildren<LinkProps> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
};

export function ButtonLink({
	variant = 'secondary',
	size = 'lg',
	children,
	className = '',
	...rest
}: ButtonLinkProps) {
	return (
		<Link
			className={buttonVariants({ variant, size, className: `no-underline ${className}` })}
			{...rest}
		>
			{children}
		</Link>
	);
}

type ActionBarProps = PropsWithChildren;

export function ActionBar({ children }: ActionBarProps) {
	return <div className="flex flex-wrap items-center justify-between gap-3 mt-4">{children}</div>;
}
