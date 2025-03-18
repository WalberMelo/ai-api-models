import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ApiKeyMiddleware } from './middleware/api-key-middleware';
import { PineconeService } from './pinecone/pinecone.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make the ConfigModule global so it's available everywhere
    }),
    ChatbotModule,
    AuthModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60, // Time window for 60 seconds
          limit: 100, // Max number of requests per user (ttl)
        },
      ],
    }),
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PineconeService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiKeyMiddleware).forRoutes('chatbot');
  }
}
