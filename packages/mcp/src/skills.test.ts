import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { McpServer } from '@modelcontextprotocol/server';
import { loadSkills } from '@modelcontextprotocol/server/ext/skills/node';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('MCP Skills', () => {
  it('lists and verifies every published skill file through MCP', async () => {
    const skillDirectory = fileURLToPath(new URL('../skills/', import.meta.url));
    const catalog = await loadSkills(skillDirectory, { strict: true });
    const server = new McpServer({ name: 'coeiro-operator-test', version: '1.0.0' });
    catalog.attach(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'coeiro-operator-skills-test', version: '1.0.0' });
    try {
      await client.connect(clientTransport);
      const skillsClient = new SkillsClient(client);
      const { skills } = await skillsClient.list();

      expect(skills.map(({ frontmatter }) => frontmatter.name).sort()).toEqual([
        'coeiro-operator-basics',
        'coeiro-operator-mode',
      ]);

      for (const skill of skills) {
        const manifest = await skillsClient.read(skill);
        expect(manifest.verified).toBe(true);
        expect(manifest.frontmatter).toEqual(skill.frontmatter);

        if (skill.resources === 'dynamic') {
          throw new Error(`Expected a static skill catalog for ${skill.frontmatter.name}`);
        }

        for (const resource of skill.resources) {
          const file = await skillsClient.read(skill, resource.uri);
          expect(file.verified).toBe(true);
          expect(file.text).toContain(`# ${skill.frontmatter.name === 'coeiro-operator-mode'
            ? 'オペレータモード'
            : 'COEIRO Operator の基本'}`);
        }
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
