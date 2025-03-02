import { Injectable } from '@nestjs/common';

// app.service not used
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
