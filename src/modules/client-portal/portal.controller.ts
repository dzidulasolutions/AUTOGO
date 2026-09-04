import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientJwtGuard } from './guards/client-jwt.guard';
import { CurrentClientId } from './decorators/current-client.decorator';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('client-portal')
@ApiBearerAuth()
@UseGuards(ClientJwtGuard)
@Public()
@Controller('client-portal')
export class PortalController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mon profil' })
  async getMe(@CurrentClientId() clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientNumber: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        photoUrl: true,
      },
    });
    return client;
  }

  @Get('loans')
  @ApiOperation({ summary: 'Mes prets' })
  getLoans(@CurrentClientId() clientId: string) {
    return this.prisma.loan.findMany({
      where: { clientId },
      include: { schedules: { orderBy: { installmentNumber: 'asc' } } },
    });
  }

  @Get('savings')
  @ApiOperation({ summary: 'Mes comptes epargne' })
  getSavings(@CurrentClientId() clientId: string) {
    return this.prisma.savingsAccount.findMany({ where: { clientId } });
  }

  @Get('tontines')
  @ApiOperation({ summary: 'Mes cycles de tontine' })
  getTontines(@CurrentClientId() clientId: string) {
    return this.prisma.tontineCycle.findMany({
      where: { clientId },
      include: { collections: { orderBy: { scheduledDate: 'asc' } } },
    });
  }
}
