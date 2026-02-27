
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UsersService,
        private readonly jwtService: JwtService,
    ) {}

    async validateUser(email: string, password: string) {
        const user = await this.userService.findByEmail(email);
        if( !user ) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if( !isPasswordValid ) {
            return null;
        }

        const { passwordHash, ...result } = user;
        return result;
    }

    async login(user: Omit<User, 'passwordHash'>) {
        const payload = { sub: user.id, email: user.email, role: user.role };

        return {
            accessToken: this.jwtService.sign(payload), user
        };
    }
}