import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 font-medium cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
	{
		variants: {
			variant: {
				primary:
					'text-white bg-accent-gold border-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.24),0_4px_12px_rgba(171,107,18,0.4)] hover:not-disabled:bg-accent-gold-light hover:not-disabled:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(171,107,18,0.5)] hover:not-disabled:-translate-y-px',
				secondary:
					'bg-bg-elevated text-text-primary border border-border-base hover:not-disabled:bg-bg-hover hover:not-disabled:border-border-hover',
				ghost:
					'bg-transparent text-text-muted border border-transparent hover:not-disabled:bg-bg-hover hover:not-disabled:text-text-primary',
				outlined:
					'bg-transparent text-text-secondary border border-border-base hover:not-disabled:bg-bg-hover hover:not-disabled:border-border-hover hover:not-disabled:text-text-primary',
				danger:
					'bg-transparent text-accent-red border border-transparent hover:not-disabled:bg-accent-red/10 hover:not-disabled:text-accent-red',
			},
			size: {
				sm: 'py-1.5 px-3 text-xs rounded-md',
				md: 'py-2.5 px-4 text-sm rounded-[10px]',
				lg: 'py-3 px-5 text-[0.95rem] rounded-[10px]',
			},
		},
		defaultVariants: {
			variant: 'secondary',
			size: 'md',
		},
	},
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonVariant = NonNullable<ButtonVariantProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantProps['size']>;
