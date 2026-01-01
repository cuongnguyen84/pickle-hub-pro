import { useState, useCallback } from 'react';
import { Bot, HelpCircle, Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenName: string;
  stepName: string;
  contextData?: Record<string, any>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

// Screen title mapping
const SCREEN_TITLES: Record<string, string> = {
  'quick-table-setup': 'Tạo giải đấu',
  'quick-table-view': 'Xem bảng đấu',
  'registration': 'Đăng ký tham gia',
  'registration-manager': 'Quản lý đăng ký',
};

export function AIAssistantDialog({
  open,
  onOpenChange,
  screenName,
  stepName,
  contextData,
}: AIAssistantDialogProps) {
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');

  const suggestedQuestions = [
    'Tôi cần làm gì ở bước này?',
    'Vì sao tôi không bấm tiếp được?',
  ];

  const handleAskQuestion = useCallback(async (question: string) => {
    if (loading) return;
    
    setLoading(true);
    setResponse('');
    
    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          screenName,
          stepName,
          contextData,
          question,
        }),
      });

      if (resp.status === 429) {
        toast.error('Hệ thống đang bận, vui lòng thử lại sau');
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits đã hết, vui lòng liên hệ admin');
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        throw new Error('Failed to start stream');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResponse = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('AI assistant error:', error);
      toast.error('Không thể kết nối AI hỗ trợ');
    } finally {
      setLoading(false);
    }
  }, [screenName, stepName, contextData, loading]);

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuestion.trim()) {
      handleAskQuestion(customQuestion.trim());
      setCustomQuestion('');
    }
  };

  const screenTitle = SCREEN_TITLES[screenName] || 'Hướng dẫn';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Hỗ trợ
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {screenTitle}
            {stepName && (
              <Badge variant="outline" className="text-xs">
                {stepName}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Suggested questions */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Câu hỏi gợi ý:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2"
                  onClick={() => handleAskQuestion(question)}
                  disabled={loading}
                >
                  <HelpCircle className="w-3 h-3 mr-1" />
                  {question}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom question input */}
          <form onSubmit={handleSubmitCustom} className="flex gap-2">
            <Input
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Hoặc nhập câu hỏi của bạn..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !customQuestion.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>

          {/* Response area */}
          {(loading || response) && (
            <ScrollArea className="flex-1 max-h-[300px] rounded-md border p-4 bg-muted/30">
              {loading && !response && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Đang phân tích...</span>
                </div>
              )}
              {response && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm">{response}</div>
                </div>
              )}
            </ScrollArea>
          )}

          {/* Context display */}
          {contextData && Object.keys(contextData).length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Dữ liệu ngữ cảnh:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(contextData).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
