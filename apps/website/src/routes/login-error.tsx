import { createFileRoute } from '@tanstack/react-router';
import type { LoginErrorReason } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../components/layout';
import { ActionBar, ButtonLink } from '../components/buttons';

const messages: Record<LoginErrorReason, { title: string; text: string }> = {
	not_a_member: {
		title: 'Kein Zugang',
		text: 'Der Login ist Mitgliedern des ONOG-Discord-Servers vorbehalten. Dein Discord-Account ist dort kein Mitglied.',
	},
	login_failed: {
		title: 'Login fehlgeschlagen',
		text: 'Bei der Anmeldung mit Discord ist etwas schiefgelaufen. Bitte versuche es erneut.',
	},
};

export const Route = createFileRoute('/login-error')({
	// Unknown or missing reasons fall back to the generic message
	validateSearch: ({ reason }: { reason?: unknown }): { reason: LoginErrorReason } => ({
		reason: reason === 'not_a_member' ? 'not_a_member' : 'login_failed',
	}),
	component: LoginError,
});

function LoginError() {
	const { reason } = Route.useSearch();
	const { title, text } = messages[reason];

	return (
		<PageContainer>
			<PageTitle>{title}</PageTitle>
			<PageSubtitle>{text}</PageSubtitle>
			<ActionBar>
				<ButtonLink variant="ghost" to="/" search={{ players: [] }}>
					← Zur Startseite
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}
