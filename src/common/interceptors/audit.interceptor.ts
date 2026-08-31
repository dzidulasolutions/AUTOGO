import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { AUDIT_RESOURCE_KEY } from '../decorators/audit-resource.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resource = this.reflector.getAllAndOverride<string>(
      AUDIT_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resource) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    const method = request.method;

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response: { id?: string } | undefined) => {
        const action =
          method === 'POST'
            ? 'CREATE'
            : method === 'DELETE'
              ? 'DELETE'
              : 'UPDATE';

        const params = request.params as Record<string, string>;
        const resourceId = response?.id ?? params?.id ?? null;

        this.prisma.auditLog
          .create({
            data: {
              userId: user?.id ?? null,
              action,
              resource,
              resourceId,
              method,
              path: request.url,
              statusCode: 200,
              ipAddress: request.ip,
            },
          })
          .catch((err: unknown) => {
            console.error('Erreur ecriture audit log', err);
          });
      }),
    );
  }
}
