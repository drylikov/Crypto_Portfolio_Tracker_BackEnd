
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUserDto {
    @IsEmail()
    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @MinLength(3)
    @IsOptional()
    username?: string;
}