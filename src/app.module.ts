
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PricesModule } from './prices/prices.module';
import { CacheModule } from '@nestjs/cache-manager';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 5000,
      max: 100,
    }),
    UsersModule, 
    AuthModule, 
    AssetsModule, 
    TransactionsModule, 
    PortfolioModule, 
    PricesModule, 
    AiModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}