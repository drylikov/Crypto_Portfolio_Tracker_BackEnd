
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type CoinGeckoSearchItem = {
  id: string;
  symbol: string;
  name: string;
};

export type CoinGeckoTopCoin = {
  id: string;      // coingeckoId
  symbol: string;
  name: string;
};

@Injectable()
export class CoinGeckoService {
  constructor(private readonly http: HttpService) {}

  private get headers() {
    const key = process.env.COINGECKO_DEMO_API_KEY;
    return key ? { 'x-cg-demo-api-key': key } : undefined;
  }

  async searchCoins(query: string): Promise<CoinGeckoSearchItem[]> {
    const q = (query ?? '').trim();
    if (!q) return [];

    const url = 'https://api.coingecko.com/api/v3/search';

    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: { query: q },
        headers: this.headers,
        timeout: 8000,
      }),
    );

    const coins = Array.isArray(data?.coins) ? data.coins : [];
    return coins.map((c: any) => ({
      id: String(c.id),
      symbol: String(c.symbol),
      name: String(c.name),
    }));
  }

  // Top coins by market cap (max per_page 250)
  async getTopCoins(limit: number): Promise<CoinGeckoTopCoin[]> {
    const perPage = Math.min(Math.max(Math.trunc(limit || 0), 1), 250);

    const url = 'https://api.coingecko.com/api/v3/coins/markets';

    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: perPage,
          page: 1,
          sparkline: false,
        },
        headers: this.headers,
        timeout: 10000,
      }),
    );

    const arr = Array.isArray(data) ? data : [];
    return arr.map((c: any) => ({
      id: String(c.id),
      symbol: String(c.symbol),
      name: String(c.name),
    }));
  }
}