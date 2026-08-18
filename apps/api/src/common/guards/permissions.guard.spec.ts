import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS } from '../rbac/permissions.constants';
import type { AccessTokenPayload } from '../../modules/auth/jwt-payload.interface';

function buildContext(user: AccessTokenPayload | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function buildUser(permissions: string[]): AccessTokenPayload {
  return { sub: 'user-1', farmId: 'farm-1', roles: [], permissions, type: 'access' };
}

describe('PermissionsGuard', () => {
  it('allows access when no permission is required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(buildContext(buildUser([])))).toBe(true);
  });

  it('allows access when the user has all required permissions', () => {
    const reflector = {
      getAllAndOverride: () => [PERMISSIONS.BUILDINGS_READ],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user = buildUser([PERMISSIONS.BUILDINGS_READ, PERMISSIONS.FARMS_READ]);
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('denies access when the user is missing a required permission', () => {
    const reflector = {
      getAllAndOverride: () => [PERMISSIONS.USERS_CREATE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const user = buildUser([PERMISSIONS.FARMS_READ]);
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: () => [PERMISSIONS.FARMS_READ],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
