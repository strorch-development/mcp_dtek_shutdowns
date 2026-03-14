import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { makePool, ensureSchema, resolveAddress, listAddresses, getLatestSnapshot } from './pg.js';

async function main() {
  const pool = makePool();
  await ensureSchema(pool);

  const server = new McpServer({
    name: 'dtek-shutdowns',
    version: '0.1.0',
  });

  server.tool(
    'list_addresses',
    {
      q: z.string().optional().describe('Search substring (optional).'),
      limit: z.number().int().min(1).max(2000).optional().describe('Max results (default 20).'),
    },
    async ({ q, limit }) => {
      const rows = await listAddresses(pool, q, limit ?? 20);
      return {
        content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
      };
    }
  );

  server.tool(
    'get_shutdowns',
    {
      address: z.string().min(1).describe('Address text to match (exact or partial).'),
      limit: z.number().int().min(1).max(50).optional().describe('How many recent snapshots to return (default 1).'),
    },
    async ({ address, limit }) => {
      const resolved = await resolveAddress(pool, address);
      if (!resolved) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'address_not_found', address }, null, 2) }],
        };
      }

      const snapshots = await getLatestSnapshot(pool, resolved.id, limit ?? 1);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                matchedAddress: resolved.address,
                snapshots,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] server started (stdio)');
}

main().catch((e) => {
  console.error('[mcp] fatal:', e);
  process.exit(1);
});
