export function parseUrlToText(url: string) {
	return url.replace(/[^a-zA-Z0-9]/g, '_');
}

export function cleanText(text: string) {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => !!line)
		.join('\n');
}

export function getExtension(text: string) {
	const regex = /(?:\.([^.]+))?$/;
	return regex.exec(text)?.[1]?.toLowerCase() ?? null;
}

export function isHTMLFile(url: string) {
	const IGNORED_EXTENSIONS = [
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.bmp',
		'.pdf',
		'.doc',
		'.docx',
		'.xls',
		'.xlsx',
		'.ppt',
		'.pptx',
		'.zip',
		'.rar',
		'.7z',
		'.exe',
		'.dmg',
		'.iso',
		'.tar',
		'.gz',
		'.csv',
	];

	const extension = getExtension(url);
	if (!extension) {
		return false;
	}
	return !IGNORED_EXTENSIONS.includes(extension);
}

export function isXML(content: string) {
	return (
		content.startsWith('<?xml') ||
		content.startsWith('<urlset') ||
		content.startsWith('<sitemapindex')
	);
}

export function isWebPage(url: string) {
	const extensions_to_exclude = [
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.bmp',
		'.ico',
		'.svg',
		'.pdf',
		'.mp3',
		'.mp4',
		'.avi',
		'.mkv',
		'.wav',
		'.ogg',
		'.zip',
		'.tar',
		'.gz',
		'.rar',
		'.7z',
		'.doc',
		'.docx',
		'.ppt',
		'.pptx',
		'.xls',
		'.xlsx',
		'.txt',
		'.rtf',
		'.csv',
		'.json',
		'.xml',
	];

	return !extensions_to_exclude.some((ext) => url.endsWith(ext + '/'));
}

export function getLink(url: string) {
	const urlObject = new URL(url);
	return `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}`;
}
