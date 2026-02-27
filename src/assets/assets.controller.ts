
import { Controller, UseGuards, Post, Body, Get, Patch, Param, Delete, Req, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService
  ) {}

  // Public: active assets (without prices)
  @Get()
  async getActiveAssets() {
    return this.assetsService.getActiveAssets();
  }

  // Public: active assets with prices (for dropdown & dashboard)
  // GET /assets/prices?refresh=1
  @Get('prices')
  async getActiveAssetsWithPrices(@Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true';
    return this.assetsService.getActiveAssetsWithPrices(force);
  }

  // Public: search coins in CoinGecko (autocomplete)
  // GET /assets/search?query=bit
  @Get('search')
  async searchCoins(@Query('query') query: string) {
    return this.assetsService.searchCoins(query);
  }

  // Admin: import top N coins
  // POST /assets/import/top?limit=200
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('import/top')
  async importTop(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 200;
    return this.assetsService.importTopCoins(n);
  }

  // Admin: all assets
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('all')
  async getAllAssets() {
    return this.assetsService.getAllAssets();
  }

  // Admin: CRUD assets
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async createAsset(@Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto);
  }

  // Admin: update asset
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.updateAsset(id, dto);
  }

  // Admin: delete asset (soft delete)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteAsset(@Param('id') id: string) {
    return this.assetsService.deleteAsset(id);
  }

}