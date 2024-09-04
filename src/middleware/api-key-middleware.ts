import {
  Injectable,
  NestMiddleware,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const apiKeyHeader = req.headers['authorization'];

    if (!apiKeyHeader || !apiKeyHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key missing or malformed.');
    }

    const apiKey = apiKeyHeader.split(' ')[1];
    const validApiKey = this.configService.get<string>('API_KEY');

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid API key.');
    }

    next();
  }
}
