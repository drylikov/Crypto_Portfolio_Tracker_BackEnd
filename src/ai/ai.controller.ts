
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('portfolio-insights')
  async portfolioInsights(@Req() req: any, @Body() body: { refresh?: boolean }) {
    const userId = req.user.userId;
    const refresh = !!body?.refresh;
    return this.aiService.generatePortfolioInsights(userId, { refresh });
  }
}