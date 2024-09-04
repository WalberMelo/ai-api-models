import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable, Logger } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';

@Injectable()
export class ChatbotService {
  private pc: Pinecone;
  private readonly logger = new Logger(ChatbotService.name);

  constructor() {
    this.pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }

  async queryVectorDatabase(question: string) {
    try {
      // Generate embeddings for the question using OpenAI API
      const embeddings = new OpenAIEmbeddings({
        modelName: 'text-embedding-ada-002',
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      const questionEmbedding = await embeddings.embedQuery(question);

      // Query the Pinecone index
      const pcIndex = this.pc.Index(process.env.PINECONE_INDEX_NAME);

      const queryResult = await pcIndex.query({
        vector: questionEmbedding,
        topK: 1,
        includeValues: true,
        includeMetadata: true,
      });

      //🧪 Uncomment bellow fo debug embedding index
      // this.logger.log('Query result:', JSON.stringify(queryResult));

      // Extract relevant document content from metadata
      const relevantDocs = queryResult.matches
        .map((match) => match.metadata.info) // Adjust if 'info' is not correct
        .join(' ');

      if (!relevantDocs) {
        return 'No relevant information found.';
      }

      // Use OpenAI API to generate a response
      const model = new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0.7,
      });

      // Build template:
      const template = ChatPromptTemplate.fromMessages([
        [
          'system',
          "Answer the user's question concisely based on the following context: {context}",
        ],
        ['user', '{input}'],
      ]);

      const chain = template.pipe(model);

      const response = await chain.invoke({
        input: question,
        context: relevantDocs,
      });

      // Extract the 'content' field from the response to return the text
      const answer = response.content; // Ensure the response has a 'content' field

      this.logger.log('Generated response:', answer);

      return answer;
    } catch (error) {
      this.logger.error('Error querying vector database:', error);
      return 'An error occurred while processing your request.';
    }
  }
}
