export function watch<T>(getter: () => T, effectCallback: (previous: T) => void | (() => void)) {
	if (typeof window === 'undefined') return; // Prevent SSR errors
	let previous: T;
	$effect(() => {
		const current = getter(); // add $state.snapshot for deep reactivity
		const cleanup = effectCallback(previous);
		previous = current;

		return cleanup;
	});
}
