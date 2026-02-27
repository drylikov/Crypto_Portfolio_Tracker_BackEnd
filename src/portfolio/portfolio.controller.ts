
import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  async getPortfolio(@Req() req: any, @Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true';
    return this.portfolioService.getPortfolio(req.user.userId, force);
  }

  @Get('summary')
  async getPortfolioSummary(@Req() req: any, @Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true';
    return this.portfolioService.getPortfolioSummary(req.user.userId, force);
  }
}