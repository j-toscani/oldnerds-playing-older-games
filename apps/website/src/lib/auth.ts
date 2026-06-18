import type { User } from '@onog/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function getLoginUrl(): string {
	return `${API_BASE}/api/auth/discord`;
}

export async function fetchCurrentUser(): Promise<User | null> {
	// During SSR, a relative URL (empty API_BASE) cannot be resolved – skip the fetch
	if (!API_BASE && typeof window === 'undefined') return null;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(`${API_BASE}/api/auth/me`, {
			credentials: 'include',
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!response.ok) return null;

		const data = (await response.json()) as { user: User | null };
		return data.user;
	} catch {
		return null;
	}
}

export async function logout(): Promise<void> {
	await fetch(`${API_BASE}/api/auth/logout`, {
		method: 'POST',
		credentials: 'include',
	});
}
