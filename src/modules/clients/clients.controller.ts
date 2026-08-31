import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @RequirePermissions('clients:create')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Creer un client' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: CurrentUserType) {
    return this.clientsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les clients (pagine)' })
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.clientsService.findAll(user, {
      page: pagination.page!,
      limit: pagination.limit!,
    });
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher un client (nom, telephone, numero)' })
  search(@Query('q') query: string, @CurrentUser() user: CurrentUserType) {
    return this.clientsService.search(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un client' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.clientsService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions('clients:update')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Modifier un client' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('clients:delete')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Desactiver un client' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.clientsService.remove(id, user);
  }

  @Get(':id/profile-complete')
  @ApiOperation({
    summary:
      "Verifier si le dossier client est complet (photo + piece d'identite)",
  })
  checkProfileComplete(@Param('id') id: string) {
    return this.clientsService.isProfileComplete(id);
  }
}
