
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
    constructor( 
        private readonly prisma: PrismaService,
    ) {}

    async createUser(dto: CreateUserDto) {
        const existingUser = await this.prisma.user.findUnique({ 
            where: { email: dto.email } 
        });
        if (existingUser) {
            throw new BadRequestException('User with this email already exists');
        }
        if(!dto.username) {
            dto.username = 'user_' + Math.random().toString(36).substring(2, 8);
            console.log('Generated username:', dto.username);
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                username: dto.username,
            },
        });

        const { passwordHash: _, ...result } = user;
        return result;
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id }});
        if(!user) {
            return null;
        }

        const { passwordHash, ...result } = user;
        return result;
    }

    async updateUser(id: string, dto: UpdateUserDto) {
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: {
                email: dto.email,
                username: dto.username,
            }
        });
        const { passwordHash, ...result } = updatedUser;
        return result;
    }

    async changePassword(id: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if(!user) {
            throw new BadRequestException('User not found');
        }

        const currentPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if(!currentPassword) {
            throw new BadRequestException('Current password is incorrect');
        }

        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id },
            data: { passwordHash: newPasswordHash }
        })
        return { message: 'Password changed successfully' };
    }

    async deleteUser(id: string) {
        await this.prisma.user.delete({ where: { id } });
        return { message: 'User deleted successfully' };
    }
}