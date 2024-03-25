// const data = await ('/Users/sanskar/Downloads/Project proposal_G3.pdf');

import { ChatOllama } from 'langchain/chat_models/ollama';
import { OllamaEmbeddings } from 'langchain/embeddings/ollama';
import {
	ChatPromptTemplate,
	HumanMessagePromptTemplate,
	SystemMessagePromptTemplate,
} from 'langchain/prompts';
import { RunnablePassthrough, RunnableSequence } from 'langchain/runnables';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { formatDocumentsAsString } from 'langchain/util/document';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { extractDataFromUrl, isExtractionError } from './utils/extract_data';

// const data = await crawl_webpage('https://medium.com/sitemap/sitemap.xml');
const data = await extractDataFromUrl(
	'https://medium.com/data-science-at-microsoft/how-large-language-models-work-91c362f5b78f'
);

if (isExtractionError(data)) {
	console.log(data.error);
} else {
	console.log('URL Data Extracted');

	const text = data.data;
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 3,
	});
	const docs = await splitter.createDocuments([text]);

	console.log('Documents Created');

	const vectorStore = await HNSWLib.fromDocuments(docs, new OllamaEmbeddings());

	const vectorStoreRetriever = vectorStore.asRetriever();

	console.log('VectorStore Generated');

	const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
	const messages = [
		SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
		HumanMessagePromptTemplate.fromTemplate('{question}'),
	];
	const prompt = ChatPromptTemplate.fromMessages(messages);
	const model = new ChatOllama({});

	console.log('Prompt Generated');

	const chain = RunnableSequence.from([
		{
			context: vectorStoreRetriever.pipe(formatDocumentsAsString),
			question: new RunnablePassthrough(),
		},
		prompt,
		model,
		new StringOutputParser(),
	]);

	console.log('Invoking Chain');

	const answer = await chain.invoke('What did the president say about Justice Breyer?');

	console.log('Chain Retrieved');

	console.log({ answer });
}
