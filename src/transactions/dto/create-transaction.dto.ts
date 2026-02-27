
import { TransactionType } from "@prisma/client";
import { IsDateString, IsDecimal, IsEnum, IsOptional, IsString } from "class-validator";

export class CreateTransactionDto {
    @IsString()
    symbol: string;

    @IsEnum(TransactionType)
    type: TransactionType;

    @IsDecimal()
    quantity: string;

    @IsDecimal()
    @IsOptional()
    price?: string;

    @IsDecimal()
    @IsOptional()
    fee?: string;    

    @IsDateString()
    @IsOptional()
    timestamp?: string;

    @IsString()
    @IsOptional()
    comment?: string;
}