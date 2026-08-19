import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Pagination limit/offset — uniquement sur Alerts/Notifications (tables qui
 * s'accumulent avec l'usage, contrairement aux données de référence comme
 * Suppliers/Customers/Buildings) : voir docs/reference/PERFORMANCE_ET_CONNECTIVITE.md,
 * qui liste explicitement la pagination comme exigence API motivée par la
 * bande passante limitée à Samba.
 */
export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
