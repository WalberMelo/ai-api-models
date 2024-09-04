// src/chatbot/chatbot.controller.ts
import { Body, Controller, Post } from '@nestjs/common';

import { ChatbotService } from './chatbot.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('query')
  async query(@Body('question') question: string) {
    const response = await this.chatbotService.queryVectorDatabase(question);
    return { answer: response };
  }
}
