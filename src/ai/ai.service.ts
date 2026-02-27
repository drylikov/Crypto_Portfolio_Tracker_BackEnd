
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildPortfolioInsightsSystemPrompt } from './prompts/portfolio-insights.prompt';
import { PortfolioService } from 'src/portfolio/portfolio.service';

@Injectable()
export class AiService {
  private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  private readonly model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  constructor(private readonly portfolio: PortfolioService) {}

  async generatePortfolioInsights(userId: string, opts?: { refresh?: boolean }) {
    const refresh = !!opts?.refresh;

    // Берём уже посчитанные данные (бизнес-логика)
    const [summary, full] = await Promise.all([
      this.portfolio.getPortfolioSummary(userId, refresh),
      this.portfolio.getPortfolio(userId, refresh),
    ]);

    // Урезаем payload, чтобы экономить токены
    const payload = {
      summary,
      items: (full.items ?? []).map((i: any) => ({
        symbol: i.asset?.symbol,
        name: i.asset?.name,
        allocationPercent: i.allocationPercent,
        balance: i.balance,
        price: i.price,
        value: i.value,
        unrealizedPnLUSD: i.unrealizedPnLUSD,
        unrealizedPnLPercent: i.unrealizedPnLPercent,
        realizedPnLUSD: i.realizedPnLUSD,
      })),
      unpricedAssets: full.unpricedAssets ?? [],
      priceUnavailableAssets: full.priceUnavailableAssets ?? [],
    };

    const system = buildPortfolioInsightsSystemPrompt();

    // Вызов модели (Chat Completions)
    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            `Analyze this portfolio data and return JSON strictly as requested.\n` +
            JSON.stringify(payload),
        },
      ],
    });

    const text = resp.choices[0]?.message?.content ?? '{}';

    // Пробуем распарсить JSON (минимальная защита)
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch {
      return { raw: text };
    }
  }
}