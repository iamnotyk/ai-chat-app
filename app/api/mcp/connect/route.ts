import { NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { ConnectRequest, ConnectResponse, MCPServerConfig } from '@/lib/mcp/types';

export async function POST(req: Request) {
  try {
    const body: ConnectRequest = await req.json();
    const { config } = body;

    // 기본 유효성 검사
    if (!config || !config.id || !config.name || !config.type) {
      return NextResponse.json<ConnectResponse>(
        { success: false, serverId: '', error: '유효하지 않은 서버 설정입니다.' },
        { status: 400 }
      );
    }

    // 타입별 필수 필드 검사
    if (config.type === 'stdio') {
      if (!config.command) {
        return NextResponse.json<ConnectResponse>(
          { success: false, serverId: '', error: 'STDIO 서버는 command가 필요합니다.' },
          { status: 400 }
        );
      }
    } else if (config.type === 'streamable-http') {
      if (!config.url) {
        return NextResponse.json<ConnectResponse>(
          { success: false, serverId: '', error: 'HTTP 서버는 URL이 필요합니다.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json<ConnectResponse>(
        { success: false, serverId: '', error: '지원하지 않는 전송 타입입니다.' },
        { status: 400 }
      );
    }

    await mcpClientManager.connect(config as MCPServerConfig);

    return NextResponse.json<ConnectResponse>({
      success: true,
      serverId: config.id,
    });
  } catch (error) {
    console.error('MCP connect error:', error);
    const message = error instanceof Error ? error.message : '연결에 실패했습니다.';
    return NextResponse.json<ConnectResponse>(
      { success: false, serverId: '', error: message },
      { status: 500 }
    );
  }
}
