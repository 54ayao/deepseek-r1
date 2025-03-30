import { z } from 'zod';

export async function searxngSearch(
  query: string,
  SEARXNG_URL = 'https://deepseek.cdn.xzzo.cn/search'
) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    engines: 'bing',
  });

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
];

const headers = {
    Origin: 'https://proxy.edgeone.app',
    // 如果需要动态设置User-Agent，可以在发送请求时从userAgents数组中随机选择一个
    // 示例：
    // 'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)]
};

  const response = await fetch(`${SEARXNG_URL}?${params}`, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();

  return data?.results || [];
}

export async function getContent(
  input: string,
  withNetwork: boolean
): Promise<{
  content: string;
  searchResults?: { title: string; url: string; content: string }[];
}> {
  if (withNetwork) {
    let searchResults;

    try {
      searchResults = await searxngSearch(input);
    } catch (err: any) {
      console.error('Search Web failed: ', err);
      return {
        content: input,
      };
    }

    const context = formatSearchResults(searchResults);

    const contentWithNetworkSearch = `
# The following content is search results based on the user's message:
${context}


r message:
${input}
    `;

    return {
      content: contentWithNetworkSearch,
      searchResults,
    };
  }

  return {
    content: input,
  };
}

function formatSearchResults(
  results: { title: string; url: string; content: string }[]
) {
  const formatted = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const index = i + 1;
    const title = result.title || 'No title';
    const url = result.url || 'No URL';
    const snippet = result.content || 'No snippet';
    formatted.push(`
[webpage ${index} begin]
Title: ${title}
Url: ${url}
Snippet: ${snippet}
[webpage ${index} end]
`);
  }
  return formatted.join('\n\n');
}

export async function onRequest({ request, params, env }: any) {
  request.headers.delete('accept-encoding');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const json = await request.clone().json();
  const result = z
    .object({
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })
      ),
      network: z.boolean().optional(),
    })
    .passthrough()
    .safeParse(json);

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.message }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const { messages, network } = result.data;
  const currentInput = messages[messages.length - 1]?.content;

  const { content, searchResults = [] } = await getContent(
    currentInput,
    !!network
  );

  messages[messages.length - 1] = {
    role: 'user',
    content,
  };

  try {
    // @ts-ignore-next-line
    const res = await AI.chatCompletions({
      model: '@tx/deepseek-ai/deepseek-r1-distill-qwen-32b',
      messages: messages,
      stream: true,
    });

    return new Response(res, {
      headers: {
        results: JSON.stringify(
          searchResults.map((item) => {
            return {
              url: item.url,
              title: encodeURIComponent(item.title),
            };
          })
        ),
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
