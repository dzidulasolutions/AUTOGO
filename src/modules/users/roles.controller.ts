import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les roles disponibles' })
  findAll() {
    return this.usersService.findAllRoles();
  }
}
