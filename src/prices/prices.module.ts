
import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PrismaService } from 'src/prisma.service';
import { HttpModule, HttpService } from '@nestjs/axios';
import { CoinGeckoService } from './coingecko.service';

@Module({
  providers: [PricesService, CoinGeckoService],
  imports: [HttpModule],
  exports: [PricesService, CoinGeckoService]
})
export class PricesModule {}