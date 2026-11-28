import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills';
import { McpServer } from '@modelcontextprotocol/server';
import type { SkillCatalog } from '@modelcontextprotocol/server/ext/skills';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOperatorSkills } from './skills.js';

async function expectServerAvailableWithoutSkills(catalog: SkillCatalog): Promise<void> {
  const server = new McpServer({ name: 'coeiro-operator-test', version: '1.0.0' });
  catalog.attach(server);
  server.registerTool(
    'health',
    { description: 'Health check', inputSchema: {} },
    async () => ({ content: [{ type: 'text', text: 'ok' }] })
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'coeiro-operator-skills-test', version: '1.0.0' });
  try {
    await client.connect(clientTransport);

    const skillsClient = new SkillsClient(client);
    const { skills } = await skillsClient.list();
    expect(skills).toEqual([]);

    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name)).toContain('health');
    const result = await client.callTool({ name: 'health', arguments: {} });
    expect(result.content).toContainEqual({ type: 'text', text: 'ok' });
  } finally {
    await client.close();
    await server.close();
  }
}

describe('MCP Skills', () => {
  it('lists and verifies every published skill file through MCP', async () => {
    const skillDirectory = fileURLToPath(new URL('../skills/', import.meta.url));
    const warnings: string[] = [];
    const catalog = await loadOperatorSkills(skillDirectory, message => warnings.push(message));
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
      expect(warnings).toEqual([]);

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

  it('warns and keeps MCP tools available when the Skills directory is missing', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-skills-'));
    const warnings: string[] = [];

    try {
      const catalog = await loadOperatorSkills(
        path.join(temporaryDirectory, 'missing'),
        message => warnings.push(message)
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Skills なしで起動を続けます');
      expect(warnings[0]).toContain('cannot be listed');
      await expectServerAvailableWithoutSkills(catalog);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('warns and keeps MCP tools available when a Skill manifest is malformed', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-skills-'));
    const brokenSkillDirectory = path.join(temporaryDirectory, 'broken-skill');
    const warnings: string[] = [];

    try {
      await mkdir(brokenSkillDirectory);
      await writeFile(path.join(brokenSkillDirectory, 'SKILL.md'), '# Missing frontmatter\n');

      const catalog = await loadOperatorSkills(
        temporaryDirectory,
        message => warnings.push(message)
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Skills なしで起動を続けます');
      expect(warnings[0]).toContain('broken-skill/SKILL.md');
      await expectServerAvailableWithoutSkills(catalog);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
