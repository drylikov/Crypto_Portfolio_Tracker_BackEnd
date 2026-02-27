
import { AssetType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateAssetDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsEnum(AssetType)
    @IsOptional()
    type?: AssetType;

    @IsString()
    @IsOptional()
    coingeckoId?: string;
}