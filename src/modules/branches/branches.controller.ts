import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  @RequirePermissions('branches:create')
  @AuditResource('Branch')
  @ApiOperation({ summary: 'Creer une agence' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les agences' })
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter une agence' })
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('branches:update')
  @AuditResource('Branch')
  @ApiOperation({ summary: 'Modifier une agence' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('branches:delete')
  @AuditResource('Branch')
  @ApiOperation({ summary: 'Desactiver une agence' })
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
