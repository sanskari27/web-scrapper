import { load as load_cheerio } from 'cheerio';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { parseStringPromise } from 'xml2js';
import { cleanText, getLink, isHTMLFile, isWebPage, isXML } from './common';
import { getSitemapsFormSitemap, getUrlsFormSitemap } from './json_utils';

type ExtractionError = {
	error: string;
};
type ExtractionSuccess = {
	data: string;
};

export type ExtractDataResult = ExtractionSuccess | ExtractionError;

export function isExtractionError(data: ExtractDataResult): data is ExtractionError {
	return 'error' in data;
}

export async function extractDataFromUrl(url: string): Promise<
	| (ExtractionSuccess & {
			url: string;
			title: string;
			text: string;
			hostname: string;
			pathname: string;
	  })
	| ExtractionError
> {
	const { hostname, pathname } = new URL(url);
	const req_headers = {
		authority: hostname,
		accept:
			'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
		'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
		referer: 'https://google.com/',
		'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
		'sec-ch-ua-mobile': '?0',
		'sec-ch-ua-platform': '"macOS"',
		'sec-fetch-dest': 'document',
		'sec-fetch-mode': 'navigate',
		'sec-fetch-site': 'same-origin',
		'sec-fetch-user': '?1',
		'upgrade-insecure-requests': '1',
		'user-agent':
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
	};

	try {
		const response = await fetch(url, { headers: req_headers });
		const html = await response.text();
		// const { data: html_data } = await axios.get(url, { headers });
		const $ = load_cheerio(html);

		// Extract headers till H4
		const html_headers = $('h1, h2, h3, h4').toArray();

		// Generate TOC
		const tocCounts = [0, 0, 0, 0];

		let toc = 'Table of Contents\n';

		html_headers.forEach((header) => {
			const level = parseInt(header.tagName[1], 10);
			tocCounts[level - 1] += 1;
			for (let i = level; i < tocCounts.length; i++) {
				tocCounts[i] = 0;
			}
			const headerText = $(header).text().replace('.', ' ');
			const tocNumber = tocCounts
				.slice(0, level)
				.filter((x) => x > 0)
				.join('-');
			toc += `${tocNumber} ${headerText}\n`;
		});
		toc += '. ';

		const rawText = $.text();
		const text = cleanText(rawText);

		const title = $('title').text() || 'Failed to extract title from the HTML';

		// Prepend TOC to the text
		const textWithToc = `${toc}\n${text}`;
		return {
			url,
			title,
			text: textWithToc,
			hostname,
			pathname,
			data: `URL: ${url}\nTitle: ${title}\nExtracted Data: ${textWithToc}`,
		};
	} catch (error: any) {
		return {
			error: `Failed to fetch the URL: ${error.message}`,
		};
	}
}

export async function extractDataFromImage(imagePath: string): Promise<ExtractDataResult> {
	try {
		const worker = await createWorker('eng');
		const ret = await worker.recognize(imagePath);
		await worker.terminate();

		return {
			data: cleanText(ret.data.text),
		};
	} catch (error: any) {
		return {
			error: `Failed to recognize text: ${error.message}`,
		};
	}
}

export async function extractDataFromFile(filePath: string): Promise<ExtractDataResult> {
	try {
		const file = Bun.file(filePath);

		const text = await file.text();

		return {
			data: cleanText(text),
		};
	} catch (error: any) {
		return {
			error: `Failed to read text file: ${error.message}`,
		};
	}
}

export async function extractDataFromDocx(filePath: string): Promise<ExtractDataResult> {
	try {
		const file = Bun.file(filePath);

		const buffer = await file.arrayBuffer();

		const mammoth_result = await mammoth.extractRawText({ arrayBuffer: buffer, path: filePath });

		return {
			data: cleanText(mammoth_result.value),
		};
	} catch (error: any) {
		return {
			error: `Failed to read text file: ${error.message}`,
		};
	}
}

export async function extractDataFromPDF(filePath: string): Promise<ExtractDataResult> {
	function pageRender(pageData: any) {
		return pageData.getTextContent().then(function (textContent: any) {
			let lastY,
				text = '';
			for (let item of textContent.items) {
				if (lastY == item.transform[5] || !lastY) {
					text += item.str;
				} else {
					text += '\n' + item.str;
				}
				text += ' ';
				lastY = item.transform[5];
			}
			return text;
		});
	}

	try {
		const file = Bun.file(filePath);

		const array_buffer = await file.arrayBuffer();
		const buffer = Buffer.from(array_buffer);
		const data = await pdf(buffer, {
			pagerender: pageRender,
		});

		return {
			data: cleanText(data.text),
		};
	} catch (error: any) {
		return {
			error: `Failed to read pdf file: ${error.message}`,
		};
	}
}

export async function crawl_webpage(link: string) {
	const url = new URL(link);
	const domain = url.hostname;

	function isDomainSame(url: string) {
		return domain === new URL(url).hostname;
	}

	async function processSitemap(url: string, visited: Set<string> = new Set()) {
		if (visited.has(url)) {
			return new Set<string>();
		}
		visited.add(url);

		const req_headers = {
			authority: domain,
			accept:
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
			'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
			referer: 'https://google.com/',
			'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"macOS"',
			'sec-fetch-dest': 'document',
			'sec-fetch-mode': 'navigate',
			'sec-fetch-site': 'same-origin',
			'sec-fetch-user': '?1',
			'upgrade-insecure-requests': '1',
			'user-agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
		};

		let content = '';
		try {
			const response = await fetch(url, { headers: req_headers });
			content = await response.text();
		} catch (err) {
			return new Set<string>();
		}

		if (isXML(content)) {
			const xml_object = await parseStringPromise(content);

			let urls = getUrlsFormSitemap(xml_object);
			const sitemaps = getSitemapsFormSitemap(xml_object);

			urls = urls.filter((url) => isDomainSame(url) && isWebPage(url));
			let urlSet = new Set(urls);
			for (const sitemap of sitemaps) {
				const _urls = await processSitemap(sitemap, visited);
				urlSet = new Set([...urlSet, ..._urls]);
			}

			return urlSet;
		} else {
			let urls = extractLinksFromHTML(content);
			urls = urls.filter((url) => isDomainSame(url) && isWebPage(url));

			return new Set(urls);
		}
	}
	const urls = await processSitemap(link);

	const url_list = [...urls];
	const final_list = url_list.filter((url) => new URL(url).hostname === domain);

	if (!link.endsWith('sitemap.xml')) {
		final_list.push(link);
	}
	return final_list;
}

export function extractLinksFromHTML(htmlText: string): string[] {
	const $ = load_cheerio(htmlText);
	const urls = $('a[href^="http"]')
		.map((_, element) => {
			const href = $(element).attr('href');
			return isHTMLFile(href ?? '') ? href : null;
		})
		.get();

	return urls.filter((url) => url).map(getLink);
}
