import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

const entry = createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});

export default entry;
