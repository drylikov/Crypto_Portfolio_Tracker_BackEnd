
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PortfolioModule } from 'src/portfolio/portfolio.module';

@Module({
  imports: [PortfolioModule],
  controllers: [AiController],  
  providers: [AiService],
})
export class AiModule {}