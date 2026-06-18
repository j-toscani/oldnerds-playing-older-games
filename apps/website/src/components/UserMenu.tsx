import type { User } from '@onog/shared';
import { useCallback } from 'react';
import { logout } from '../lib/auth';
import { LoginButton } from './LoginButton';
import { useNavigate, useRouteContext } from '@tanstack/react-router';

interface UserMenuProps {
	user: User | null;
	onLogout: () => void;
}

function getAvatarUrl(user: User): string {
	if (user.avatar) {
		return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`;
	}
	// Discord default avatar
	const index = (Number(user.discordId) >> 22) % 6;
	return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function UserMenu() {
	const navigate = useNavigate()
	const { user } = useRouteContext({ from: '__root__' })

	if (!user) { return <LoginButton /> }

	const handleLogout = useCallback(async () => {
		await logout()
		navigate({ to: '/', search: { players: [] } })
	}, [user])

	return (
		<div className="flex items-center gap-3">
			<img
				src={getAvatarUrl(user)}
				alt={user.username}
				width={28}
				height={28}
				className="rounded-full"
			/>
			<span className="text-sm text-text-secondary font-medium">
				{user.username}
			</span>
			<button
				type="button"
				onClick={handleLogout}
				className="text-text-muted hover:text-text-primary cursor-pointer bg-transparent border-none font-medium text-xs transition-colors duration-200"
			>
				Logout
			</button>
		</div>
	);
}
