import { NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { StatusResponse } from '@/lib/mcp/types';

export async function GET() {
  try {
    const connectedServers = mcpClientManager.getConnectedServers();

    return NextResponse.json<StatusResponse>({
      connectedServers,
    });
  } catch (error) {
    console.error('MCP status error:', error);
    return NextResponse.json<StatusResponse>(
      { connectedServers: [] },
      { status: 500 }
    );
  }
}
