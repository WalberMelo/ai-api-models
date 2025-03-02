import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get the DOMAIN_ORIGIN from environment variables (for production)
  const domainOrigin = configService.get<string>('DOMAIN_ORIGIN');

  // Add localhost for development
  const allowedOrigins = [domainOrigin, 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,POST,OPTIONS',
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    preflightContinue: false,
  });

  await app.listen(3000);
}

bootstrap();
