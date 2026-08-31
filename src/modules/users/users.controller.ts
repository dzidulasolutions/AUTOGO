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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AuditResource } from '../../common/decorators/audit-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../types/express';

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
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.usersService.findAll(user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Consulter mon propre profil' })
  getMyProfile(@CurrentUser() user: CurrentUserType) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({
    summary: 'Modifier mon profil (adresse, ville, date de naissance)',
  })
  updateMyProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/contact')
  @ApiOperation({ summary: 'Modifier mon email ou telephone' })
  updateMyContact(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateContactDto,
  ) {
    return this.usersService.updateContact(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un utilisateur' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @AuditResource('User')
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @AuditResource('User')
  @ApiOperation({ summary: 'Desactiver un utilisateur (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.usersService.remove(id, user);
  }
}
