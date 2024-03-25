import { getLink, isHTMLFile } from './common';

export function getAllOccurrences(obj: Record<string, unknown>, target: string): string[] {
	const results = [];
	for (const key in obj) {
		if (key === target) {
			results.push(obj[key]);
		}

		if (typeof obj[key] === 'object' && obj[key] !== null) {
			// Recursively search in nested objects
			const nested_arr = getAllOccurrences(obj[key] as Record<string, unknown>, target);
			results.push(...nested_arr);
		}
	}
	return results.flat() as string[];
}

export function getSitemapsFormSitemap(xml_object: {
	sitemapindex: { sitemap: { loc: string }[] };
}): string[] {
	if ('sitemapindex' in xml_object && 'sitemap' in xml_object.sitemapindex) {
		return xml_object.sitemapindex.sitemap
			.map((el) => el.loc)
			.filter(isHTMLFile)
			.flat();
	}
	return [];
}

export function getUrlsFormSitemap(xml_object: { urlset: { url: { loc: string }[] } }): string[] {
	if ('urlset' in xml_object && 'url' in xml_object.urlset) {
		return xml_object.urlset.url
			.map((el) => getLink(el.loc))
			.filter(isHTMLFile)
			.flat();
	}
	return [];
}
