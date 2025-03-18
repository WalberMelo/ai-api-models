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

interface InvoiceI {
  invoiceId: string;
  text: string;
}

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
    const invoices: InvoiceI[] = [];
    let processedCount = 0;
    const maxRows = 11; // Limit to 10 rows for demo purposes
    let headersSet = false;
    let headers: string[] = [];

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const finalize = async () => {
        if (isResolved) return;

        isResolved = true;
        try {
          await this.pineconeService.addInvoices(invoices);
          resolve({
            message: 'Invoices processed successfully.',
            count: invoices.length,
          });
        } catch (error) {
          reject(error);
        } finally {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Error deleting file:', e);
          }
        }
      };

      const stream = fs
        .createReadStream(filePath)
        .pipe(csvParser({ separator: ';', headers: true }))
        .on('data', async (row) => {
          if (processedCount >= maxRows) {
            stream.destroy(); // Stop reading more rows
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
          invoices.push({ invoiceId: generatedId, text: invoiceText });
        })
        .on('end', finalize)
        .on('close', finalize)
        .on('error', (error) => {
          if (!isResolved) {
            isResolved = true;
            reject(error);
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              console.error('Error deleting file:', e);
            }
          }
        });
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
