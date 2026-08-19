import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Pathless layout route that guards everything nested below it: without a
 * Discord session the visitor never reaches the component, so protected pages
 * don't each have to render their own logged-out state.
 *
 * `context.user` comes from the root route's `beforeLoad`, which is already
 * resolved by the time this runs. Unauthenticated visitors go to `/`, where the
 * navbar holds the Discord login — the OAuth callback returns to the site root
 * anyway (`ALLOWED_ORIGIN` in `apps/api/src/routes/auth.ts`), so there is no
 * deep link to preserve.
 *
 * No `component`: it defaults to an `<Outlet />`.
 */
export const Route = createFileRoute('/_unauthenticated')({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw redirect({ to: '/', search: { players: [] } });
		}
	},
});
