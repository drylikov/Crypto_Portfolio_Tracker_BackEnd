
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';
import { PricesService } from 'src/prices/prices.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

type PositionState = {
  qty: Prisma.Decimal;        // current quantity (open position)
  cost: Prisma.Decimal;       // current cost basis for open qty
  realized: Prisma.Decimal;   // realized pnl accumulated
};

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricesService: PricesService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getPortfolio(userId: string, refresh = false) {
    const cacheKey = `portfolio:v2:${userId}`; // bump version because response changed

    if (!refresh) {
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
    }

    const computed = await this.computePortfolio(userId, refresh);

    if (!refresh) {
      // TTL 10 seconds
      await this.cache.set(cacheKey, computed, 10);
    }
    return computed;
  }

  async getPortfolioSummary(userId: string, refresh = false) {
    const full = await this.getPortfolio(userId, refresh);

    // unrealized total = sum of unrealizedPnLUSD where not null
    let totalUnrealized = new Prisma.Decimal(0);
    // realized total = sum of realizedPnLUSD where not null
    let totalRealized = new Prisma.Decimal(0);

    let pricedCount = 0;

    for (const i of full.items) {
      if (i.unrealizedPnLUSD !== null) {
        totalUnrealized = totalUnrealized.add(new Prisma.Decimal(i.unrealizedPnLUSD));
      }
      if (i.realizedPnLUSD !== null) {
        totalRealized = totalRealized.add(new Prisma.Decimal(i.realizedPnLUSD));
      }
      if (i.price !== null) pricedCount++;
    }

    const totalPnL = totalUnrealized.add(totalRealized);

    const totalValue = new Prisma.Decimal(full.totalValueUSD);
    const totalPnLPercent =
      totalValue.gt(0) ? totalPnL.div(totalValue).mul(100) : null;

    return {
      totalValueUSD: full.totalValueUSD,
      totalFeeUSDT: full.totalFeeUSDT,
      totalUnrealizedPnLUSD: totalUnrealized.toString(),
      totalRealizedPnLUSD: totalRealized.toString(),
      totalPnLUSD: totalPnL.toString(),
      totalPnLPercent: totalPnLPercent ? totalPnLPercent.toFixed(2) : null,
      positionsCount: full.items.length,
      pricedPositionsCount: pricedCount,
      unpricedAssetsCount: full.unpricedAssets.length,
      priceUnavailableAssetsCount: full.priceUnavailableAssets.length,
    };
  }

  private async computePortfolio(userId: string, refresh = false) {
    const balances = await this.calcBalances(userId);
    const totalFeeUSDT = await this.sumFeesUSDT(userId);

    // fee is deducted from USDT balance
    await this.applyFeeToUsdtBalance(balances, totalFeeUSDT);

    const assets = await this.loadAssetsForBalances(balances);
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const pricesById = await this.loadPricesByCoingeckoId(assets, refresh);

    // positions now include realized pnl
    const positions = await this.calcPositionsAvgCostWithRealized(userId);

    const itemsRaw = this.buildItems({
      balances,
      assetById,
      pricesById,
      positions,
    });

    // sort by value desc (nulls at the bottom)
    itemsRaw.sort((a, b) => {
      if (a.value === null && b.value === null) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return new Prisma.Decimal(b.value).cmp(new Prisma.Decimal(a.value));
    });

    // totalValueUSD (only value != null)
    let totalValueUSD = new Prisma.Decimal(0);
    for (const item of itemsRaw) {
      if (item.value !== null) {
        totalValueUSD = totalValueUSD.add(new Prisma.Decimal(item.value));
      }
    }

    // true unpriced: missing coingeckoId (crypto only)
    const unpricedAssets = itemsRaw
      .filter((i) => !i.asset.coingeckoId && i.asset.type === 'CRYPTO')
      .map((i) => ({ symbol: i.asset.symbol, name: i.asset.name }));

    // temporarily unavailable: has coingeckoId but price is null
    const priceUnavailableAssets = itemsRaw
      .filter((i) => i.asset.coingeckoId && i.price === null)
      .map((i) => ({ symbol: i.asset.symbol, name: i.asset.name }));

    // allocation percentage
    const totalIsZero = totalValueUSD.eq(0);
    const itemsWithAllocation = itemsRaw.map((i) => {
      if (i.value === null || totalIsZero) {
        return { ...i, allocationPercent: null as string | null };
      }
      const percent = new Prisma.Decimal(i.value).div(totalValueUSD).mul(100);
      return { ...i, allocationPercent: percent.toFixed(2) };
    });

    // filter out zero balances
    const itemsFiltered = itemsWithAllocation.filter((i) => {
      return !new Prisma.Decimal(i.balance).eq(0);
    });

    return {
      totalFeeUSDT: totalFeeUSDT.toString(),
      totalValueUSD: totalValueUSD.toString(),
      items: itemsFiltered,
      unpricedAssets,
      priceUnavailableAssets,
    };
  }

  private async calcBalances(userId: string) {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['assetId', 'type'],
      where: { userId },
      _sum: { quantity: true },
    });

    const balances = new Map<string, Prisma.Decimal>();

    for (const row of grouped) {
      const qty = row._sum.quantity ?? new Prisma.Decimal(0);
      const current = balances.get(row.assetId) ?? new Prisma.Decimal(0);

      let next = current;

      if (row.type === TransactionType.BUY || row.type === TransactionType.DEPOSIT) {
        next = current.add(qty);
      } else if (row.type === TransactionType.SELL || row.type === TransactionType.WITHDRAW) {
        next = current.sub(qty);
      }

      balances.set(row.assetId, next);
    }

    return balances;
  }

  private async sumFeesUSDT(userId: string) {
    const feeAgg = await this.prisma.transaction.aggregate({
      where: { userId },
      _sum: { fee: true },
    });

    return feeAgg._sum.fee ?? new Prisma.Decimal(0);
  }

  private async applyFeeToUsdtBalance(
    balances: Map<string, Prisma.Decimal>,
    totalFeeUSDT: Prisma.Decimal,
  ) {
    const usdt = await this.prisma.asset.findUnique({
      where: { symbol: 'USDT' },
      select: { id: true },
    });

    if (!usdt) throw new NotFoundException("Asset 'USDT' not found (needed for fees)");

    const usdtBalance = balances.get(usdt.id) ?? new Prisma.Decimal(0);
    balances.set(usdt.id, usdtBalance.sub(totalFeeUSDT));
  }

  private async loadAssetsForBalances(balances: Map<string, Prisma.Decimal>) {
    const assetIds = Array.from(balances.keys());

    return this.prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: {
        id: true,
        symbol: true,
        name: true,
        type: true,
        isActive: true,
        coingeckoId: true,
      },
    });
  }

  private async loadPricesByCoingeckoId(assets: any[], refresh = false) {
    const coingeckoIds = Array.from(
      new Set(
        assets
          .map((a) => a.coingeckoId)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    return this.pricesService.getUsdPricesByIds(coingeckoIds, { refresh });
  }

  /**
   * Average Cost positions + realized pnl.
   * - BUY increases qty and cost (includes fee)
   * - SELL realizes pnl: proceeds - costSold - fee
   * - cost basis reduced by avgCost * qtySold
   */
  private async calcPositionsAvgCostWithRealized(userId: string) {
    const tradeTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        assetId: true,
        type: true,
        quantity: true,
        price: true,
        fee: true,
      },
    });

    const positions = new Map<string, PositionState>();

    for (const tx of tradeTx) {
      const qty = tx.quantity ?? new Prisma.Decimal(0);
      const price = tx.price; // Decimal | null
      const fee = tx.fee ?? new Prisma.Decimal(0);

      const state = positions.get(tx.assetId) ?? {
        qty: new Prisma.Decimal(0),
        cost: new Prisma.Decimal(0),
        realized: new Prisma.Decimal(0),
      };

      if (tx.type === TransactionType.BUY) {
        if (!price) {
          // no price => skip (should not happen due to validation)
          positions.set(tx.assetId, state);
          continue;
        }

        // cost increases by qty * price
        state.qty = state.qty.add(qty);
        state.cost = state.cost.add(qty.mul(price));

        // fee (USDT ~ USD) increases cost basis
        state.cost = state.cost.add(fee);

        positions.set(tx.assetId, state);
        continue;
      }

      // SELL
      if (tx.type === TransactionType.SELL) {
        if (!price) {
          positions.set(tx.assetId, state);
          continue;
        }
        if (state.qty.lte(0)) {
          // nothing to sell, ignore (should be prevented by tx validation)
          positions.set(tx.assetId, state);
          continue;
        }

        // if user sells more than position, clamp to available (safety)
        const sellQty = qty.gt(state.qty) ? state.qty : qty;

        // avg cost per unit
        const avgCost = state.cost.div(state.qty);

        // proceeds = sellQty * sellPrice
        const proceeds = sellQty.mul(price);

        // costSold = sellQty * avgCost
        const costSold = sellQty.mul(avgCost);

        // realized pnl delta = proceeds - costSold - fee
        const realizedDelta = proceeds.sub(costSold).sub(fee);

        state.realized = state.realized.add(realizedDelta);

        // reduce open position
        state.qty = state.qty.sub(sellQty);
        state.cost = state.cost.sub(costSold);

        // avoid tiny negatives due to decimals
        if (state.qty.lt(0)) state.qty = new Prisma.Decimal(0);
        if (state.cost.lt(0)) state.cost = new Prisma.Decimal(0);

        positions.set(tx.assetId, state);
        continue;
      }
    }

    return positions;
  }

  private buildItems(params: {
    balances: Map<string, Prisma.Decimal>;
    assetById: Map<string, any>;
    pricesById: Record<string, Prisma.Decimal | null>;
    positions: Map<string, PositionState>;
  }) {
    const { balances, assetById, pricesById, positions } = params;
    const assetIds = Array.from(balances.keys());

    const items = assetIds.map((assetId) => {
      const asset = assetById.get(assetId);
      if (!asset) return null;

      const balance = balances.get(assetId) ?? new Prisma.Decimal(0);
      const price = asset.coingeckoId ? (pricesById[asset.coingeckoId] ?? null) : null;
      const value = price ? balance.mul(price) : null;

      const pos = positions.get(assetId) ?? {
        qty: new Prisma.Decimal(0),
        cost: new Prisma.Decimal(0),
        realized: new Prisma.Decimal(0),
      };

      const avgBuyPrice = pos.qty.gt(0) ? pos.cost.div(pos.qty) : null;
      const costBasisUSD = pos.cost;

      const currentValueUSD = value;
      const unrealizedPnLUSD =
        currentValueUSD !== null ? currentValueUSD.sub(costBasisUSD) : null;

      const unrealizedPnLPercent =
        unrealizedPnLUSD !== null && costBasisUSD.gt(0)
          ? unrealizedPnLUSD.div(costBasisUSD).mul(100)
          : null;

      const realizedPnLUSD = pos.realized;

      return {
        asset: {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          isActive: asset.isActive,
          coingeckoId: asset.coingeckoId,
        },

        balance: balance.toString(),
        price: price?.toString() ?? null,
        value: value?.toString() ?? null,

        avgBuyPrice: avgBuyPrice ? avgBuyPrice.toFixed(8) : null,
        costBasisUSD: costBasisUSD.toString(),
        currentValueUSD: currentValueUSD ? currentValueUSD.toString() : null,

        unrealizedPnLUSD: unrealizedPnLUSD ? unrealizedPnLUSD.toString() : null,
        unrealizedPnLPercent: unrealizedPnLPercent ? unrealizedPnLPercent.toFixed(2) : null,

        realizedPnLUSD: realizedPnLUSD ? realizedPnLUSD.toString() : "0",
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return items;
  }
}