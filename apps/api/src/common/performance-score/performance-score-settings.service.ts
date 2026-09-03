import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PerformanceScoreCoefficients } from '../calculations/performance-score.util';

/**
 * Score de performance (Lot 5) — lecture/écriture des coefficients dans
 * `Setting`, mutualisée entre Chair/Pondeuses/Couvoir (3 usages dès ce lot
 * — mutualiser au 2e/3e usage, doctrine déjà appliquée à
 * `performance-score.util.ts`). Premier vrai chemin d'ÉCRITURE de tout le
 * projet vers `Setting` (voir DETTE_TECHNIQUE.md Lot 5, investigation
 * point 3) : jusqu'ici, tous les seuils existants (mortalité, ponte...)
 * n'étaient que lus, jamais modifiables via l'API.
 *
 * Validation du corps de requête déléguée aux DTOs par type (champs
 * nommés, pas de map dynamique — voir
 * broiler-batches/dto/update-broiler-performance-coefficients.dto.ts) :
 * ce service reste agnostique du type de bande, il ne fait que
 * sérialiser/désérialiser un `PerformanceScoreCoefficients` sous une clé
 * `Setting` donnée.
 */
@Injectable()
export class PerformanceScoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoefficients(farmId: string, settingKey: string): Promise<PerformanceScoreCoefficients> {
    const setting = await this.prisma.setting.findUnique({
      where: { farmId_key: { farmId, key: settingKey } },
    });
    if (
      !setting ||
      typeof setting.value !== 'object' ||
      setting.value === null ||
      Array.isArray(setting.value)
    ) {
      return {};
    }
    // Frontière de confiance légitime : `Setting.value` (Json Prisma) n'a
    // aucune structure connue côté base — seul `setCoefficients`
    // ci-dessous y écrit, donc la forme est garantie par ce service lui-même,
    // jamais par le schéma. `as unknown as` explicite ici, contrairement aux
    // conversions DTO -> Coefficients (coefficientsFromDto), qui restent
    // typées sans cast.
    return setting.value as unknown as PerformanceScoreCoefficients;
  }

  async setCoefficients(
    farmId: string,
    settingKey: string,
    coefficients: PerformanceScoreCoefficients,
  ): Promise<PerformanceScoreCoefficients> {
    await this.prisma.setting.upsert({
      where: { farmId_key: { farmId, key: settingKey } },
      update: { value: coefficients as unknown as Prisma.InputJsonValue },
      create: { farmId, key: settingKey, value: coefficients as unknown as Prisma.InputJsonValue },
    });
    return coefficients;
  }
}
