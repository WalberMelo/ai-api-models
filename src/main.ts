import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const domainOrigin = configService.get<string>('DOMAIN_ORIGIN');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin === domainOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,POST',
    credentials: true,
  });
  await app.listen(3000);
}
bootstrap();
