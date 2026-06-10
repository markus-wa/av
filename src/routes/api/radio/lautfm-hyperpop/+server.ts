import type { RequestHandler } from './$types';

const RADIO_URL = 'https://stream.laut.fm/hyperpop';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const response = await fetch(RADIO_URL);

		// Stream the response to avoid memory issues with audio
		const stream = response.body;

		return new Response(stream, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (error) {
		console.error('Radio proxy error:', error);
		return new Response('Radio stream unavailable', { status: 502 });
	}
};
