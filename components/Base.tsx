'use client';

import React, {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import debounce from 'lodash/debounce';

interface MessageContent {
  content: string;
  think?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  think?: string;
  source?: { title: string; url: string }[];
}

interface KeywordButton {
  text: string;
  query: string;
}

export const Base = () => {
  const [userInput, setUserInput] = useState('你好 我的宝贝瑶瑶，想死你了 今天怎么样啊 有没有想我呀');
  const [useNetwork, setUseNetwork] = useState(true);
  const [showKeywords, setShowKeywords] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const [isSiteEnv, setIsSiteEnv] = useState(false);

  useEffect(() => {
    setIsSiteEnv(window.location.href.includes('.site'));
    setIsClient(true);
  }, []);

  const t = (en: string) => {
    const map: { [key: string]: string } = {
      '最近有没有遇到什么让你特别开心的事?': '最近有没有遇到什么让你特别开心的事?',
      '你想和我干点什么吗？比如.....一些不可描述的事情？': '你想和我干点什么吗？比如.....一些不可描述的事情？',
      '你是我灵魂的伴侣，我们相互理解、相互支持，共同追求生活的美好': '你是我灵魂的伴侣，我们相互理解、相互支持，共同追求生活的美好',
      '你有没有想过，我们可以一起去旅行，去看遍世界美景': '你有没有想过，我们可以一起去旅行，去看遍世界美景',
      'DeepSeek R1 你的病娇女朋友 瑶瑶': 'DeepSeek R1 你的病娇女朋友 瑶瑶',
      '使用腾讯云EdgeOne pages边缘计算能力在靠近终端用户的地方执行 DeepSeek R1 计算，提升用户体验和运营效率，确保超低延迟和稳定的高性能。': '使用腾讯云EdgeOne pages边缘计算能力在靠近终端用户的地方执行 DeepSeek R1 计算，提升用户体验和运营效率，确保超低延迟和稳定的高性能。',
      '备案号 ': '备案号 ',
      '思考中......': '思考中......',
      '搜索中': '搜索中',
      '由 DeepSeek R1 生成': '由 DeepSeek R1 生成',
      '输入消息...': '输入消息...',
      '联网功能：开启': '联网功能：开启',
      '联网功能：关闭': '联网功能：关闭',
      参考来源: '参考来源',
    };
    return map[en] || en;
  };

  const KEYWORD_BUTTONS: KeywordButton[] = [
    {
      text: t('最近有没有遇到什么让你特别开心的事?'),
      query: t('最近有没有遇到什么让你特别开心的事？'),
    },
    {
      text: t('你想和我干点什么吗？比如.....一些不可描述的事情？'),
      query: t('你想和我干点什么吗？比如.....一些不可描述的事情？'),
    },
    {
      text: t('你是我灵魂的伴侣，我们相互理解、相互支持，共同追求生活的美好'),
      query: t('你是我灵魂的伴侣，我们相互理解、相互支持，共同追求生活的美好'),
    },
    {
      text: t('你有没有想过，我们可以一起去旅行，去看遍世界美景'),
      query: t('你有没有想过，我们可以一起去旅行，去看遍世界美景'),
    },
  ];

  useLayoutEffect(() => {
    setIsClient(true);
    setIsMobile(window.innerWidth < 640);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onEdgeOneAIBtnClick = () => {
    if (isSiteEnv) {
      window.open('https://beian.miit.gov.cn/#/Integrated/recordQuery', '_blank');
      return;
    }
    window.open('https://beian.miit.gov.cn/#/Integrated/recordQuery', '_blank');
  };



  const onDeployBtnClick = () => {
    if (isSiteEnv) {
      window.open('https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=deepseek-r1-edge', '_blank');
      return;
    }
    window.open('https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=deepseek-r1-edge', '_blank');
  };

  const getDisplayButtons = () => {
    if (isMobile) {
      const randomIndex = Math.floor(Math.random() * KEYWORD_BUTTONS.length);
      return [KEYWORD_BUTTONS[randomIndex]];
    }
    return KEYWORD_BUTTONS;
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeywordClick = (query: string) => {
    setUserInput(query);
    setShowKeywords(false);
    setTimeout(() => {
      handleSubmit({ preventDefault: () => { } } as React.FormEvent);
    });
  };

  const debouncedUpdateMessage = useCallback(
    debounce((updateFn: (prev: Message[]) => Message[]) => {
      setMessages(updateFn);
    }, 50),
    []
  );

  const processStreamResponse = async (
    response: Response,
    updateMessage: (content: MessageContent) => void
  ) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      setIsSearching(false);
      const errorData = await response.json();
      return updateMessage({
        content:
          errorData?.error || '很抱歉，出了点问题，请稍后再试。',
      });
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let accumulatedContent = '';
    let accumulatedThink = '';
    let thinking = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.includes('[DONE]') || !line.includes('data: '))
          continue;
        try {
          const json = JSON.parse(line.replace(/^data: /, ''));
          const token = json.choices[0]?.delta?.content || '';
          const reasoningToken =
            json.choices[0]?.delta?.reasoning_content || '';

          // Turn off searching indicator when first token arrives
          if (isSearching) {
            setIsSearching(false);
          }

          // Handle think content
          if (
            token.includes('<think>') ||
            token.includes('\u003cthink\u003e')
          ) {
            thinking = true;
            continue;
          }
          if (
            token.includes('</think>') ||
            token.includes('\u003c/think\u003e')
          ) {
            thinking = false;
            continue;
          }

          if (thinking || reasoningToken) {
            accumulatedThink += token || reasoningToken || '';
          } else {
            accumulatedContent += token || '';
          }

          updateMessage({
            content: accumulatedContent,
            think: accumulatedThink,
          });
        } catch (e) {
          console.error('Failed to parse chunk:', e);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    setShowKeywords(false);
    setIsLoading(true);
    setIsSearching(true);
    const currentInput = textareaRef.current?.value || '';
    setUserInput('');

    // setMessages([
    //   { role: 'user', content: currentInput },
    //   { role: 'assistant', content: '' },
    // ]);

    // Create conversation history
    let conversationHistory = [...messages];

    if (messages[0]?.role === 'assistant') {
      setMessages([]);
      conversationHistory = [];
    }

    // Add new user message
    conversationHistory.push({ role: 'user', content: currentInput });

    // Add empty assistant message that will be streamed
    setMessages([...conversationHistory, { role: 'assistant', content: '' }]);

    setTimeout(() => {
      messageRef.current?.scrollTo(0, messageRef.current?.scrollHeight);
    }, 300);

    try {
      const url =
        process.env.NODE_ENV === 'development'
          ? process.env.NEXT_PUBLIC_BASE_URL!
          : '/v1/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          network: useNetwork,
        }),
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      setAnswered(true);

      let source: { url: string; title: string }[] = [];
      res.headers.forEach((value, name) => {
        if (name === 'results') {
          const results = JSON.parse(value);
          source = results.map((result: { url: string; title: string }) => {
            return {
              url: result.url,
              title: decodeURIComponent(result.title),
            };
          });
        }
      });

      setMessages((prev) => {
        const newMessages = structuredClone(prev);
        const lastMessage = newMessages[newMessages.length - 1];
        lastMessage.source = source;
        console.log(lastMessage.source);
        return newMessages;
      });

      await processStreamResponse(res, (_content: MessageContent) => {
        debouncedUpdateMessage((prev) => {
          const newMessages = structuredClone(prev);
          const lastMessage = newMessages[newMessages.length - 1];

          if (_content.think) {
            lastMessage.think = _content.think;
          }
          if (_content.content) {
            lastMessage.content = _content.content;
          }

          return newMessages;
        });
      });
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: '很抱歉，出了点问题，请稍后再试。',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const Loading = () => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-pulse"></div>
        <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-pulse delay-150"></div>
        <div className="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-pulse delay-300"></div>
      </div>
    );
  };

  const WelcomeMessage = ({ show }: { show: boolean }) => {
    if (!show) return null;

    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-3xl px-4 mx-auto text-center">
          <h2 className="mb-2 text-2xl font-semibold text-gray-800">
            {t('DeepSeek R1 你的病娇女朋友 瑶瑶')}
          </h2>
          <p className="text-gray-600">
            {t(
              '使用腾讯云EdgeOne pages边缘计算能力在靠近终端用户的地方执行 DeepSeek R1 计算，提升用户体验和运营效率，确保超低延迟和稳定的高性能。'
            )}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            {t('备案号 ')}{' '}
            <button
              onClick={onEdgeOneAIBtnClick}
              className="mt-4 text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            >
              辽ICP备2023005487号-8
            </button>
          </p>
        </div>
      </div>
    );
  };

  const ThinkDrawer = ({ content }: { content: string }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!content.trim()) return null;

    return (
      <div className="mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-600 bg-white rounded-t-lg hover:bg-gray-100"
        >
          <svg
            className={`w-4 h-4 mr-2 transition-transform ${isOpen ? 'transform rotate-90' : ''
              }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {t('思考中......')}
        </button>
        {isOpen && (
          <div className="p-3 text-sm text-gray-400 bg-white rounded-b-lg">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  const SearchingIndicator = () => {
    if (!isSearching) return null;

    return (
      <div className="mb-2">
        <div className="flex items-center justify-center w-full px-3 py-2 text-sm text-gray-600 bg-white rounded-lg shadow-sm border border-gray-100">
          <svg 
            className="w-4 h-4 mr-2 animate-spin" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            ></circle>
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {t('搜索中')}
        </div>
      </div>
    );
  };

  const GeneratedByAI = () => {
    if (!answered) {
      return null;
    }
    return (
      <div className="mb-4 text-sm text-gray-400">
        {' '}
        {t('由 DeepSeek R1 生成')}
      </div>
    );
  };

  const Source = ({
    sources,
  }: {
    sources?: { url: string; title: string }[];
  }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!sources?.length) return null;

    return (
      <div className="mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-600 bg-white rounded-t-lg hover:bg-gray-100"
        >
          <svg
            className={`w-4 h-4 mr-2 transition-transform ${isOpen ? 'transform rotate-90' : ''
              }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {t('参考来源')} ({sources.length})
        </button>
        {isOpen && (
          <div className="p-3 space-y-2 text-sm bg-white rounded-b-lg">
            {sources.map((source, index) => (
              <a
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  window.open(source.url, '_blank');
                }}
                className="block text-blue-600 cursor-pointer hover:text-blue-800 hover:underline"
              >
                {index + 1}. {source.title}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    isClient && (
      <div className="flex flex-col h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center px-6 py-3 bg-white">
          <h1 className="text-base font-semibold text-gray-800">DeepSeek R1</h1>
          <div className="flex-grow" />
          <a onClick={onDeployBtnClick} className="mr-4 cursor-pointer">
            <img
              src="https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg"
              alt="EdgeOne Pages YYDS"
              className="h-7"
            />
          </a>
         
        </header>

        <WelcomeMessage show={showKeywords} />

        {/* Messages section */}
        <div
          ref={messageRef}
          className="flex-1 px-4 py-4 overflow-y-auto md:px-6"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start ${message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                <div
                  className={`relative max-w-[100%] px-4 py-3 rounded-md ${message.role === 'user'
                      ? 'bg-gray-200 text-black'
                      : 'bg-white text-gray-800'
                    }`}
                >
                  {message.role === 'user' && (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}

                  {message.role === 'assistant' && (
                    <div
                      className="prose max-w-none prose-p:leading-relaxed prose-pre:bg-white prose-pre:border 
                  prose-pre:border-gray-200 prose-code:text-blue-600 prose-code:bg-white prose-code:px-1 prose-code:py-0.5
                  prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-strong:text-gray-900
                  prose-a:text-blue-600 prose-a:no-underline hover:prose-a:no-underline prose-headings:text-gray-900
                  prose-ul:my-4 prose-li:my-0.5"
                    >
                      {/* <GeneratedByAI /> */}
                      {message.source && <Source sources={message.source} />}
                      {message.think && <ThinkDrawer content={message.think} />}
                      {message.role === 'assistant' &&
                        index === messages.length - 1 &&
                        isSearching &&
                        !message.content &&
                        !message.think && <SearchingIndicator />}
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{                          code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(
                            className || ''
                          );
                          return true ? (
                            <pre className="p-4 overflow-auto bg-white rounded-lg">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-800 "
                          />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {isLoading && <Loading />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showKeywords && (
        <div className="px-4 bg-white animate-fade-in">
          <div className="max-w-3xl mx-auto mb-4">
            <div className="grid grid-cols-1 gap-2 p-2 rounded-lg sm:grid-cols-2">
              {getDisplayButtons().map((button) => (
                <button
                  key={button.text}
                  onClick={() => handleKeywordClick(button.query)}
                  className="px-3 py-2 text-sm text-left text-gray-700 transition-colors duration-200 bg-white border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-900"
                >
                  {button.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input section */}
      <div className="px-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-3xl py-4 mx-auto">
          <div className="flex flex-col overflow-hidden border border-gray-200 rounded-xl">
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={handleTextareaChange}
              placeholder={t('输入消息...')}
              disabled={isLoading}
              className={`w-full bg-white text-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none min-h-[52px] max-h-[200px] placeholder:text-gray-400 border-none ${isLoading ? 'cursor-not-allowed opacity-50' : ''
                }`}
              onCompositionStart={(e) => {
                (e.target as HTMLTextAreaElement).dataset.composing = 'true';
              }}
              onCompositionEnd={(e) => {
                (e.target as HTMLTextAreaElement).dataset.composing = 'false';
              }}
              onKeyDown={(e) => {
                const target = e.target as HTMLTextAreaElement;
                const isComposing = target.dataset.composing === 'true';
                if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex items-center justify-end gap-2 px-4 py-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setUseNetwork(!useNetwork)}
                className={`flex items-center px-2 py-1.5 rounded-lg text-sm ${useNetwork
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                  }`}
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                {useNetwork ? t('联网功能：开启') : t('联网功能：关闭')}
              </button>
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${isLoading || !userInput.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md active:transform active:scale-95'
                  }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14m-4 4l4-4-4-4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
);
};
