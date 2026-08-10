import { SetMetadata } from '@nestjs/common';

export const AUDIT_RESOURCE_KEY = 'auditResource';
export const AuditResource = (resource: string) =>
  SetMetadata(AUDIT_RESOURCE_KEY, resource);
