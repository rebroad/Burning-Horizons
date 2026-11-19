export const MAX_SPEECH_LENGTH = 180;

export function cleanSpeechText(value) {
	if (typeof value !== 'string') return '';
	return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
