
import { BadRequestException, ConflictException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Prisma, AssetType } from '@prisma/client';
import { PricesService } from 'src/prices/prices.service';
import { CoinGeckoService } from 'src/prices/coingecko.service';

@Injectable()
export class AssetsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly pricesService: PricesService,
        private readonly coinGecko: CoinGeckoService,
    ) {}

    async getActiveAssets() {
        return await this.prisma.asset.findMany({ 
            where: { isActive: true },
            orderBy: { symbol: 'asc' } 
        });
    }

    async getAllAssets() {
        return await this.prisma.asset.findMany({
            orderBy: { symbol: 'asc' }
        });
    }

    async createAsset(dto: CreateAssetDto) {
        const symbol = dto.symbol.trim().toUpperCase();
        const symbolExists = await this.prisma.asset.findUnique({
            where: { symbol: symbol }
        });
        if(symbolExists) {
            throw new ConflictException("Asset with this symbol already exists");
        }

        const asset = await this.prisma.asset.create({
            data: {
                name: dto.name,
                symbol: symbol,
                type: dto.type,
                coingeckoId: dto.coingeckoId
            }
        })
        return asset;
    }

    async updateAsset(id: string, dto: UpdateAssetDto) {
        if (dto.name === undefined && dto.type === undefined && dto.coingeckoId === undefined) {
            throw new BadRequestException('Nothing to update');
        }

        try {
            const asset = await this.prisma.asset.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name } : {}),
                    ...(dto.type !== undefined ? { type: dto.type } : {}),
                    ...(dto.coingeckoId !== undefined ? { coingeckoId: dto.coingeckoId } : {})
                },
            });
            return asset;
        } 
        catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
                throw new NotFoundException('Asset not found');
            }
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictException('Unique constraint violation');
            }
            throw e;
        }
    }

    async deleteAsset(id: string) {
        const asset = await this.prisma.asset.findUnique({ where: { id } });

        if (!asset) {
            throw new NotFoundException('Asset not found');
        }

        if (!asset.isActive) {
            return { message: 'Asset already deleted' };
        }

        await this.prisma.asset.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
            },
        });
        return { message: 'Asset deleted successfully' };
    }

    // prices list for dropdown/dashboard
    async getActiveAssetsWithPrices(refresh = false) {
        const assets = await this.prisma.asset.findMany({
        where: { isActive: true },
        select: {
            id: true,
            symbol: true,
            name: true,
            type: true,
            isActive: true,
            coingeckoId: true,
        },
        orderBy: { symbol: 'asc' },
        });

        const ids = assets
            .map((a) => a.coingeckoId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        const pricesById = await this.pricesService.getUsdPricesByIds(ids, { refresh });

        return assets.map((a) => {
            const price = a.coingeckoId ? pricesById[a.coingeckoId] ?? null : null;
            return { ...a, price: price?.toString() ?? null };
        });
    }

    // search coins in CoinGecko API
    async searchCoins(query: string) {
        return this.coinGecko.searchCoins(query);
    }

    // import top N coins (admin)
    async importTopCoins(limit = 200) {
        const n = Math.min(Math.max(Math.trunc(limit || 0), 1), 250);

        const top = await this.coinGecko.getTopCoins(n);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        const errors: Array<{ symbol: string; id: string; reason: string }> = [];

        for (const c of top) {
            const symbol = c.symbol.trim().toUpperCase();
            const name = c.name.trim();
            const coingeckoId = c.id.trim();

            if (!symbol || !name || !coingeckoId) {
                skipped++;
                continue;
            }

            const existing = await this.prisma.asset.findUnique({ where: { symbol } });

            try {
                if (!existing) {
                    await this.prisma.asset.create({
                        data: {
                            symbol,
                            name,
                            type: AssetType.CRYPTO,
                            coingeckoId,
                            isActive: true,
                        },
                    });
                    created++;
                } 
                else {
                    await this.prisma.asset.update({
                        where: { id: existing.id },
                        data: {
                        name,
                        type: AssetType.CRYPTO,
                        coingeckoId,
                        isActive: true,
                        deletedAt: null,
                        },
                    });
                    updated++;
                }
            } 
            catch (e: any) {
                errors.push({
                    symbol,
                    id: coingeckoId,
                    reason: e?.message ?? 'unknown',
                });
            }
        }

        return {
            requested: n,
            created,
            updated,
            skipped,
            errorsCount: errors.length,
            errors,
        };
    }

}