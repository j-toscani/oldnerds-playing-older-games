import type { PropsWithChildren } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';

type ButtonLinkProps = PropsWithChildren<LinkProps> & {
	variant: 'primary' | 'ghost' | 'outline';
	className?: string;
};

const variantClasses = {
	primary:
		'text-white bg-accent-gold hover:bg-accent-gold-light shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(171,107,18,0.4)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(171,107,18,0.5)]',
	ghost: 'text-text-secondary hover:text-text-primary bg-transparent border-none',
	outline:
		'text-text-primary bg-bg-elevated border border-border-base hover:bg-bg-hover hover:border-border-hover',
} as const;

export function ButtonLink({ variant, children, className, ...rest }: ButtonLinkProps) {
	return (
		<Link
			className={`inline-flex items-center justify-center gap-2 py-3 px-5 rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 no-underline ${variantClasses[variant]} ${className ?? ''}`}
			{...rest}
		>
			{children}
		</Link>
	);
}

type ActionBarProps = PropsWithChildren;

export function ActionBar({ children }: ActionBarProps) {
	return <div className="flex flex-wrap items-center gap-3 mt-4">{children}</div>;
}
