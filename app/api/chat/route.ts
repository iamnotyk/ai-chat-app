import { GoogleGenAI, mcpToTool } from "@google/genai";
import { mcpClientManager } from "@/lib/mcp/client-manager";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export async function POST(req: Request) {
  try {
    const { message, history, activeServerIds } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response("GEMINI_API_KEY is not defined", { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // History formatting
    const contents = history?.map((msg: { role: string; text: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })) || [];

    // Get active MCP clients
    const tools: any[] = [];
    if (activeServerIds && Array.isArray(activeServerIds)) {
      for (const serverId of activeServerIds) {
        const client = mcpClientManager.getClient(serverId);
        if (client) {
          tools.push(mcpToTool(client));
        }
      }
    }

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: contents,
      config: {
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    // We need to handle the stream and potentially tool calls manually 
    // to send events to the client.
    // However, mcpToTool with the SDK's auto-execution might hide details.
    // The Google GenAI Node SDK's `sendMessageStream` with tools *usually* 
    // handles the loop if tools are provided.
    // To visualize, we might need to intercept or use a lower-level approach,
    // but the SDK structure is evolving. 
    // 
    // For now, let's assume the standard stream emits what's happening. 
    // If not, we might only get the final result. 
    // Given the requirement to visualize, sending the final text is the MVP.
    // But to really show "Calling tool...", we'd need to know.
    //
    // Update: The `mcpToTool` integration in the official SDK often includes 
    // the execution logic. 
    // Let's try to stream the response. If the SDK emits tool call chunks, we forward them.
    
    const result = await chat.sendMessageStream({ message });
    
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const send = (type: string, data: any) => {
          const json = JSON.stringify({ type, ...data });
          controller.enqueue(encoder.encode(json + '\n'));
        };

        try {
          for await (const chunk of result) {
            // Check for function calls in the chunk
            const functionCalls = chunk.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                send('call', { 
                  tool: call.name, 
                  args: call.args 
                });
              }
            }

            const text = chunk.text;
            if (text) {
              send('text', { content: text });
            }
          }
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    console.error("Error in chat route:", error);
    
    let errorMessage = "Internal Server Error";
    let statusCode = 500;
    
    const err = error as { status?: number; message?: string };

    if (err?.status === 429) {
      errorMessage = "API 사용량이 초과되었습니다 (429).";
      statusCode = 429;
    } else if (err?.message) {
      errorMessage = `API Error: ${err.message}`;
    }

    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: statusCode,
      headers: { "Content-Type": "application/json" }
    });
  }
}
