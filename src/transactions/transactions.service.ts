
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Prisma, TransactionType, AssetType } from '@prisma/client';
import { PricesService } from 'src/prices/prices.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricesService: PricesService,
  ) {}

  async getUserTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      include: { asset: { select: { symbol: true, name: true, type: true } } },
    });
  }

  async getAllTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: { timestamp: 'desc' },
      include: { asset: { select: { symbol: true, name: true, type: true } } },
    });
  }

  private async getAssetBalanceForUser(userId: string, assetId: string) {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, assetId },
      _sum: { quantity: true },
    });

    let balance = new Prisma.Decimal(0);

    for (const row of grouped) {
      const qty = row._sum.quantity ?? new Prisma.Decimal(0);

      if (row.type === TransactionType.BUY || row.type === TransactionType.DEPOSIT) {
        balance = balance.add(qty);
      } else if (row.type === TransactionType.SELL || row.type === TransactionType.WITHDRAW) {
        balance = balance.sub(qty);
      }
    }

    return balance;
  }

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    if (!userId) throw new BadRequestException('Missing userId');

    const symbol = dto.symbol.trim().toUpperCase();

    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      select: {
        id: true,
        symbol: true,
        isActive: true,
        type: true,
        coingeckoId: true,
      },
    });

    if (!asset) throw new NotFoundException(`Asset '${symbol}' not found`);
    if (!asset.isActive) throw new ConflictException(`Asset '${asset.symbol}' is inactive`);

    const isTrade = dto.type === TransactionType.BUY || dto.type === TransactionType.SELL;
    const isOutflow =
      dto.type === TransactionType.SELL || dto.type === TransactionType.WITHDRAW;

    // quantity validation (for all types)
    const qty = new Prisma.Decimal(dto.quantity);
    if (!qty.isFinite() || qty.lte(0)) {
      throw new BadRequestException('Quantity must be > 0');
    }

    // SELL/WITHDRAW no more than balance
    if (isOutflow) {
      const currentBalance = await this.getAssetBalanceForUser(userId, asset.id);
      if (qty.gt(currentBalance)) {
        throw new BadRequestException(
          `Insufficient balance. Available=${currentBalance.toString()} Requested=${qty.toString()}`,
        );
      }
    }

    // price rules:
    // - CRYPTO + BUY/SELL: price is ALWAYS auto from server
    // - FIAT + BUY/SELL: price is REQUIRED from dto
    // - DEPOSIT/WITHDRAW: price not required
    let priceToStore: string | undefined = undefined;

    if (isTrade) {
      if (asset.type === AssetType.FIAT) {
        if (!dto.price) {
          throw new BadRequestException('Price is required for FIAT BUY/SELL');
        }
        const p = new Prisma.Decimal(dto.price);
        if (!p.isFinite() || p.lte(0)) {
          throw new BadRequestException('Price must be > 0');
        }
        priceToStore = p.toString();
      } else {
        // CRYPTO
        if (!asset.coingeckoId) {
          throw new BadRequestException(`Asset '${asset.symbol}' has no coingeckoId`);
        }

        const prices = await this.pricesService.getUsdPricesByIds(
          [asset.coingeckoId],
          // refresh=false: get cache; if cache is missing, try API, on failure return null
          { refresh: false },
        );

        const px = prices[asset.coingeckoId];

        if (!px) {
          throw new BadRequestException(
            `Price unavailable for '${asset.symbol}'. Try again later.`,
          );
        }

        priceToStore = px.toString();
      }
    } else {
      // DEPOSIT/WITHDRAW -> ignore dto.price
      priceToStore = undefined;
    }

    // fee validation (optional)
    if (dto.fee !== undefined) {
      const f = new Prisma.Decimal(dto.fee);
      if (!f.isFinite() || f.lt(0)) {
        throw new BadRequestException('Fee must be >= 0');
      }
    }

    const data: any = {
      userId,
      assetId: asset.id,
      type: dto.type,
      quantity: dto.quantity,
      comment: dto.comment,
      ...(dto.fee !== undefined ? { fee: dto.fee } : {}),
      ...(priceToStore !== undefined ? { price: priceToStore } : {}),
      ...(dto.timestamp !== undefined ? { timestamp: new Date(dto.timestamp) } : {}),
    };

    return this.prisma.transaction.create({ data });
  }
}