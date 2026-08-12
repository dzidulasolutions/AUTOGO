import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @RequirePermissions('clients:create')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Creer un client' })
  create(@Body() dto: CreateClientDto, @Req() req) {
    return this.clientsService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les clients (pagine)' })
  findAll(@Query() pagination: PaginationDto, @Req() req) {
    return this.clientsService.findAll(req.user, {
      page: pagination.page!,
      limit: pagination.limit!,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un client' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.clientsService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions('clients:update')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Modifier un client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @Req() req) {
    return this.clientsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @RequirePermissions('clients:delete')
  @AuditResource('Client')
  @ApiOperation({ summary: 'Desactiver un client' })
  remove(@Param('id') id: string, @Req() req) {
    return this.clientsService.remove(id, req.user);
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
