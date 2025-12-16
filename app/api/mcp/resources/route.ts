import { NextRequest, NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { ResourceReadRequest, ResourceReadResponse, MCPResource } from '@/lib/mcp/types';

// Resources 목록 조회
export async function GET(req: NextRequest) {
  try {
    const serverId = req.nextUrl.searchParams.get('serverId');

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'serverId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json(
        { success: false, error: '연결되지 않은 서버입니다.' },
        { status: 400 }
      );
    }

    const resources: MCPResource[] = await mcpClientManager.listResources(serverId);

    return NextResponse.json({
      success: true,
      resources,
    });
  } catch (error) {
    console.error('MCP listResources error:', error);
    const message = error instanceof Error ? error.message : 'Resources 조회에 실패했습니다.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Resource 읽기
export async function POST(req: Request) {
  try {
    const body: ResourceReadRequest = await req.json();
    const { serverId, uri } = body;

    if (!serverId || !uri) {
      return NextResponse.json<ResourceReadResponse>(
        { success: false, error: 'serverId와 uri가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json<ResourceReadResponse>(
        { success: false, error: '연결되지 않은 서버입니다.' },
        { status: 400 }
      );
    }

    const contents = await mcpClientManager.readResource(serverId, uri);

    return NextResponse.json<ResourceReadResponse>({
      success: true,
      contents,
    });
  } catch (error) {
    console.error('MCP readResource error:', error);
    const message = error instanceof Error ? error.message : 'Resource 읽기에 실패했습니다.';
    return NextResponse.json<ResourceReadResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
