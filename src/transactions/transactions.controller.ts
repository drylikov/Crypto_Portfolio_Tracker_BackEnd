
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService
  ) {}

  @Get()
  async getUserTransactions(@Req() req: any) {
    return this.transactionsService.getUserTransactions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('all')
  async getAllTransactions() {
    return this.transactionsService.getAllTransactions();
  }

  @Post()
  async createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.createTransaction(req.user.userId, dto);
  }


}