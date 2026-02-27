
import { AssetType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateAssetDto {
    @IsString()
    symbol: string;

    @IsString()
    name: string;

    @IsEnum(AssetType)
    type: AssetType;

    @IsString()
    coingeckoId: string;
}