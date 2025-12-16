import { NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { DisconnectRequest, DisconnectResponse } from '@/lib/mcp/types';

export async function POST(req: Request) {
  try {
    const body: DisconnectRequest = await req.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json<DisconnectResponse>(
        { success: false, error: 'serverId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json<DisconnectResponse>(
        { success: false, error: '연결되지 않은 서버입니다.' },
        { status: 400 }
      );
    }

    await mcpClientManager.disconnect(serverId);

    return NextResponse.json<DisconnectResponse>({
      success: true,
    });
  } catch (error) {
    console.error('MCP disconnect error:', error);
    const message = error instanceof Error ? error.message : '연결 해제에 실패했습니다.';
    return NextResponse.json<DisconnectResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
