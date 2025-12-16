import { NextRequest, NextResponse } from 'next/server';
import { mcpClientManager } from '@/lib/mcp/client-manager';
import type { PromptGetRequest, PromptGetResponse, MCPPrompt } from '@/lib/mcp/types';

// Prompts 목록 조회
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

    const prompts: MCPPrompt[] = await mcpClientManager.listPrompts(serverId);

    return NextResponse.json({
      success: true,
      prompts,
    });
  } catch (error) {
    console.error('MCP listPrompts error:', error);
    const message = error instanceof Error ? error.message : 'Prompts 조회에 실패했습니다.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Prompt 가져오기
export async function POST(req: Request) {
  try {
    const body: PromptGetRequest = await req.json();
    const { serverId, promptName, arguments: args } = body;

    if (!serverId || !promptName) {
      return NextResponse.json<PromptGetResponse>(
        { success: false, error: 'serverId와 promptName이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!mcpClientManager.isConnected(serverId)) {
      return NextResponse.json<PromptGetResponse>(
        { success: false, error: '연결되지 않은 서버입니다.' },
        { status: 400 }
      );
    }

    const messages = await mcpClientManager.getPrompt(serverId, promptName, args);

    return NextResponse.json<PromptGetResponse>({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('MCP getPrompt error:', error);
    const message = error instanceof Error ? error.message : 'Prompt 가져오기에 실패했습니다.';
    return NextResponse.json<PromptGetResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
