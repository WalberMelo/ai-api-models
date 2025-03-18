import { Module } from '@nestjs/common';

import { PineconeService } from 'src/pinecone/pinecone.service';
import { InvoicesController } from './invoices.controller';

@Module({
  controllers: [InvoicesController],
  providers: [PineconeService],
  exports: [PineconeService],
})
export class InvoicesModule {}
