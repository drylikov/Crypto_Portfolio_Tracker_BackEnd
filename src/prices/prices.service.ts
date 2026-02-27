
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PricesService {
  constructor(
    private readonly http: HttpService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private readonly ttlMs = 20_000;

  async getUsdPricesByIds(ids: string[], opts?: { refresh?: boolean }): Promise<Record<string, Prisma.Decimal | null>> {
    const refresh = !!opts?.refresh;

    const normalized = Array.from(
      new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean)),
    );

    if (normalized.length === 0) return {};

    const result: Record<string, Prisma.Decimal | null> = {};
    const missing: string[] = [];

    // Always read cache as fallback
    // - if refresh=false: get from cache and do not add to missing
    // - if refresh=true: get from cache (so there's something to return on failure),
    //   but still add to missing to attempt an update
    for (const id of normalized) {
      const cached = await this.cache.get<string | null>(`price:usd:${id}`);

      if (cached !== undefined) {
        result[id] = cached === null ? null : new Prisma.Decimal(cached);
      } else {
        result[id] = null;
      }

      if (refresh || cached === undefined) {
        missing.push(id);
      }
    }

    // everything is in cache and refresh=false
    if (missing.length === 0) return result;

    // Try to update missing prices via CoinGecko
    const url = 'https://api.coingecko.com/api/v3/simple/price';
    const apiKey = process.env.COINGECKO_DEMO_API_KEY;

    let data: any = null;

    try {
      const resp = await firstValueFrom(
        this.http.get(url, {
          params: { ids: missing.join(','), vs_currencies: 'usd' },
          timeout: 8000,
          headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
        }),
      );
      data = resp.data;
    } catch (err: any) {
      // Any error (including 429) -> return what was already in result (cache)
      return result;
    }

    // If the request succeeded — update result + cache
    for (const id of missing) {
      const usd = data?.[id]?.usd;

      if (usd === undefined || usd === null) {
        // if CoinGecko didn't return a price for id — leave cache/null as is
        continue;
      }

      const value = new Prisma.Decimal(String(usd));
      result[id] = value;

      const cacheValue = value.toString();
      await this.cache.set(`price:usd:${id}`, cacheValue, this.ttlMs);
    }

    return result;
  }

}