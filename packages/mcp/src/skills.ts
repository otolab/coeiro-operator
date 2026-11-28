import {
  memorySkillFiles,
  SkillCatalogError,
  SkillsExtension,
  type SkillCatalog,
} from '@modelcontextprotocol/server/ext/skills';
import { loadSkills } from '@modelcontextprotocol/server/ext/skills/node';
import { logger } from '@coeiro-operator/common';

export async function loadOperatorSkills(
  directory: string,
  warn: (message: string) => void = message => logger.warn(message)
): Promise<SkillCatalog> {
  try {
    return await loadSkills(directory, { strict: true });
  } catch (error) {
    if (!SkillCatalogError.isInstance(error)) {
      throw error;
    }

    const problems = error.problems
      .map(problem => `${problem.path}: ${problem.message}`)
      .join('; ');
    warn(`MCP Skills を読み込めないため、Skills なしで起動を続けます。${problems}`);

    // The failure was already logged above; suppress the SDK's generic empty-catalog warning.
    return SkillsExtension.load(memorySkillFiles({}), { onWarning: () => {} });
  }
}
