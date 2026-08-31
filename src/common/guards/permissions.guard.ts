import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { Request } from 'express';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de decorateur @RequirePermissions -> route accessible a tout utilisateur connecte
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifie');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: user.role },
      include: { permissions: { include: { permission: true } } },
    });

    const userPermissionKeys =
      role?.permissions.map((rp) => rp.permission.key) ?? [];

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissionKeys.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission d'effectuer cette action",
      );
    }

    return true;
  }
}
