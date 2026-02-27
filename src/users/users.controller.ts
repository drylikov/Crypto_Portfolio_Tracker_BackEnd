
import { Body, Controller, Delete, Get, Put, Req, UseGuards, } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user.userId;
    return this.usersService.findById(userId);
  }

  @Put()
  async updateUser(@Req() req: any, @Body() dto: UpdateUserDto) {
    const userId = req.user.userId;
    return this.usersService.updateUser(userId, dto);
  }

  @Put('me/password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user.userId;
    return this.usersService.changePassword(userId, dto);
  }

  @Delete('me')
  async deleteUser(@Req() req: any) {
    const userId = req.user.userId;
    return this.usersService.deleteUser(userId);
  }
}