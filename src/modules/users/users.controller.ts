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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Req } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';


@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Creer un utilisateur' })
  @AuditResource('User')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  findAll(@Req() req) {
    return this.usersService.findAll(req.user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Consulter mon propre profil' })
  getMyProfile(@Req() req) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me/profile')
  @ApiOperation({
    summary: 'Modifier mon profil (adresse, ville, date de naissance)',
  })
  updateMyProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('me/contact')
  @ApiOperation({ summary: 'Modifier mon email ou telephone' })
  updateMyContact(@Req() req, @Body() dto: UpdateContactDto) {
    return this.usersService.updateContact(req.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un utilisateur' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.usersService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @AuditResource('User')
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req) {
    return this.usersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @AuditResource('User')
  @ApiOperation({ summary: 'Desactiver un utilisateur (soft delete)' })
  remove(@Param('id') id: string, @Req() req) {
    return this.usersService.remove(id, req.user);
  }
}
