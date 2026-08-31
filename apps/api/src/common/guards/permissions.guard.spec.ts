import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { ANY_PERMISSIONS_METADATA_KEY } from '../decorators/require-permissions.decorator';
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

  // RequireAnyPermission (Lot 7-correctif) — OU, indépendant du groupe ET
  // ci-dessus. Les mocks distinguent explicitement les deux clés de
  // métadonnées (contrairement aux tests ET ci-dessus, où les deux appels
  // recevaient la même valeur sans que ça n'affecte l'issue attendue).
  function buildAnyReflector(anyPermissions: string[] | undefined): Reflector {
    return {
      getAllAndOverride: (key: string) =>
        key === ANY_PERMISSIONS_METADATA_KEY ? anyPermissions : undefined,
    } as unknown as Reflector;
  }

  it('allows access when the user has at least one of the RequireAnyPermission permissions', () => {
    const guard = new PermissionsGuard(
      buildAnyReflector([PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.ATTENDANCE_READ]),
    );
    const user = buildUser([PERMISSIONS.ATTENDANCE_READ]);
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('denies access when the user has none of the RequireAnyPermission permissions', () => {
    const guard = new PermissionsGuard(
      buildAnyReflector([PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.ATTENDANCE_READ]),
    );
    const user = buildUser([PERMISSIONS.FARMS_READ]);
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });
});
