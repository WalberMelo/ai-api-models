import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as csvParser from 'csv-parser';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';

import { PineconeService } from 'src/pinecone/pinecone.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly pineconeService: PineconeService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${uniqueSuffix}-${file.originalname}`);
        },
      }),
    }),
  )
  async uploadInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filePath = path.resolve('./uploads', file.filename);
    const invoices = [];
    let processedCount = 0;
    const maxRows = 10;
    let headersSet = false;
    let headers: string[] = [];

    return new Promise((resolve, reject) => {
      const stream = fs
        .createReadStream(filePath)
        .pipe(csvParser({ separator: ';', headers: true }))
        .on('data', async (row) => {
          if (processedCount >= maxRows) {
            stream.destroy();

            return;
          }
          processedCount++;

          if (!headersSet) {
            headers = Object.values(row);
            headersSet = true;
            return;
          }

          // Map row values to headers dynamically
          const parsedRow = headers.reduce((acc, key, i) => {
            acc[key] = row[`_${i}`];
            return acc;
          }, {} as Record<string, string>);

          const generatedId = randomUUID();
          const invoiceText = JSON.stringify(parsedRow);
          invoices.push(invoiceText);

          try {
            await this.pineconeService.addInvoiceText(generatedId, invoiceText);
          } catch (error) {
            console.error(
              `Error adding invoice ${row.InvoiceID} to Pinecone:`,
              error,
            );
          }
        })
        .on('end', () => {
          resolve({
            message: 'Invoices processed successfully',
            count: invoices.length,
          });
          fs.unlinkSync(filePath); // Clean up uploaded file after processing
        })
        .on('error', reject);
    });
  }

  @Post('reminder')
  async sendReminder(@Body() body: { invoiceId: string }) {
    const matches = await this.pineconeService.filterInvoice(body.invoiceId);

    if (!matches) {
      return { message: 'Invoice not found in Pinecone' };
    }

    const invoiceText = String(matches.metadata?.text || '');
    const reminderMessage = await this.pineconeService.generateReminder(
      invoiceText,
    );
    return { reminderMessage };
  }

  @Post('search')
  async searchInvoiceQuery(@Body() body: { query: string }) {
    if (!body.query) {
      throw new BadRequestException('Query parameter is required');
    }

    try {
      const response = await this.pineconeService.searchInvoice(body.query);
      return { message: response };
    } catch (error) {
      console.error('Error querying Pinecone:', error);
      throw new InternalServerErrorException('Failed to query Pinecone');
    }
  }

  @Post('details')
  async invoiceDetailsQuery(
    @Body() body: { invoiceId: string; question: string },
  ) {
    if (!body.invoiceId || !body.question) {
      throw new BadRequestException('Both invoiceId and question are required');
    }

    try {
      const matches = await this.pineconeService.filterInvoice(body.invoiceId);

      if (!matches) {
        return { message: 'Invoice not found in Pinecone' };
      }

      const invoiceText = String(matches.metadata?.text || '');
      const aiResponse = await this.pineconeService.invoiceDetails(
        invoiceText,
        body.question,
      );

      return {
        invoiceId: body.invoiceId,
        question: body.question,
        answer: aiResponse,
      };
    } catch (error) {
      console.error('Error processing AI query:', error);
      throw new InternalServerErrorException('Failed to process AI query');
    }
  }
}
