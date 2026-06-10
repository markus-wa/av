import type { RequestHandler } from './$types';

const RADIO_URL = 'http://hydra.shoutca.st:8268/live.mp3';

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
