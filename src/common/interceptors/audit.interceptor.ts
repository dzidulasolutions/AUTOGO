import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { AUDIT_RESOURCE_KEY } from '../decorators/audit-resource.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const resource = this.reflector.getAllAndOverride<string>(
      AUDIT_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de decorateur @AuditResource() sur cette route -> pas d'audit
    if (!resource) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // On n'audite que les actions qui modifient des donnees
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        const action =
          method === 'POST'
            ? 'CREATE'
            : method === 'DELETE'
              ? 'DELETE'
              : 'UPDATE';

        const resourceId = response?.id ?? request.params?.id ?? null;

        // Ecriture "fire and forget" : ne bloque jamais la reponse HTTP,
        // et une erreur d'audit ne doit jamais faire echouer l'action metier elle-meme
        this.prisma.auditLog
          .create({
            data: {
              userId: request.user?.id ?? null,
              action,
              resource,
              resourceId,
              method,
              path: request.url,
              statusCode: 200,
              ipAddress: request.ip,
            },
          })
          .catch((err) => {
            console.error('Erreur ecriture audit log', err);
          });
      }),
    );
  }
}
