import { useState } from 'react';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIAssistantDialog } from './AIAssistantDialog';

interface AIAssistantButtonProps {
  screenName: string;
  stepName: string;
  contextData?: Record<string, any>;
}

export function AIAssistantButton({ screenName, stepName, contextData }: AIAssistantButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline">AI</span>
      </Button>
      
      <AIAssistantDialog
        open={open}
        onOpenChange={setOpen}
        screenName={screenName}
        stepName={stepName}
        contextData={contextData}
      />
    </>
  );
}
