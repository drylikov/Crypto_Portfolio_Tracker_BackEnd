
import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { PrismaService } from 'src/prisma.service';
import { PricesModule } from 'src/prices/prices.module';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService, PrismaService],
  imports: [PricesModule],
  exports: [PortfolioService],
})
export class PortfolioModule {}