
import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { PrismaService } from 'src/prisma.service';
import { PricesModule } from 'src/prices/prices.module';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, PrismaService],
  imports: [PricesModule],
})
export class AssetsModule {
  
}