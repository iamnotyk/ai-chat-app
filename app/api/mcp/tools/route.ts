import { NextRequest, NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { ToolCallRequest, ToolCallResponse, MCPTool } from '@/lib/mcp/types';

// Tools 목록 조회
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

    const tools: MCPTool[] = await mcpClientManager.listTools(serverId);

    return NextResponse.json({
      success: true,
      tools,
    });
  } catch (error) {
    console.error('MCP listTools error:', error);
    const message = error instanceof Error ? error.message : 'Tools 조회에 실패했습니다.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Tool 실행
export async function POST(req: Request) {
  try {
    const body: ToolCallRequest = await req.json();
    const { serverId, toolName, arguments: args } = body;

    if (!serverId || !toolName) {
      return NextResponse.json<ToolCallResponse>(
        { success: false, error: 'serverId와 toolName이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json<ToolCallResponse>(
        { success: false, error: '연결되지 않은 서버입니다.' },
        { status: 400 }
      );
    }

    const content = await mcpClientManager.callTool(serverId, toolName, args || {});

    return NextResponse.json<ToolCallResponse>({
      success: true,
      content,
    });
  } catch (error) {
    console.error('MCP callTool error:', error);
    const message = error instanceof Error ? error.message : 'Tool 실행에 실패했습니다.';
    return NextResponse.json<ToolCallResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
