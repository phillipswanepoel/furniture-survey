import type { ThemePreference } from './types';

export function applyThemePreference(theme: ThemePreference) {
	if (typeof document === 'undefined') return;

	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}

export function isThemePreference(value: string): value is ThemePreference {
	return value === 'system' || value === 'light' || value === 'dark';
}
