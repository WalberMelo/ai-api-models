import { OpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private llm: OpenAI;

  constructor() {
    this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    this.llm = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async addInvoiceText(invoiceId: string, text: string) {
    const vector = await this.embeddings.embedQuery(text);
    await this.pinecone.index('invoices').upsert([
      {
        id: invoiceId,
        values: vector,
        metadata: { text, invoiceId },
      },
    ]);
  }

  async searchInvoice(query: string) {
    try {
      const vector = await this.embeddings.embedQuery(query);

      const index = this.pinecone.index('invoices');
      if (!index) {
        throw new Error('Pinecone index "invoices" not found');
      }

      const results = await index.query({
        vector,
        topK: 10,
        includeMetadata: true,
      });

      return results.matches;
    } catch (error) {
      console.error('Pinecone query error:', error);
      throw new Error('Failed to retrieve results from Pinecone');
    }
  }

  async filterInvoice(invoiceId: string) {
    try {
      const index = this.pinecone.index('invoices');
      if (!index) {
        throw new Error('Pinecone index "invoices" not found');
      }

      // Use fetch instead of query similarity for exact match
      const result = await index.fetch([invoiceId]);

      return result.records[invoiceId] || null;
    } catch (error) {
      console.error('Pinecone fetch error:', error);
      throw new Error('Failed to retrieve invoice from Pinecone');
    }
  }

  async generateReminder(invoiceText: string) {
    const prompt = `Generate a professional yet friendly payment reminder email for the following invoice details: ${invoiceText}`;
    return await this.llm.invoke(prompt);
  }

  async invoiceDetails(invoiceText: string, question: string) {
    const prompt = `You are an AI assistant helping with invoice management. Answer the following question based on this invoice data:\n\n${invoiceText}\n\nQuestion: ${question}`;
    return await this.llm.invoke(prompt);
  }
}
