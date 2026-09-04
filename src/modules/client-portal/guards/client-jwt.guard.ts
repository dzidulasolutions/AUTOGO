import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface ClientJwtPayload {
  sub: string;
  phone: string;
  type: string;
}

@Injectable()
export class ClientJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify<ClientJwtPayload>(token);

      if (payload.type !== 'client') {
        throw new UnauthorizedException('Token invalide pour ce contexte');
      }

      (request as Request & { clientId: string }).clientId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou expire');
    }
  }
}
