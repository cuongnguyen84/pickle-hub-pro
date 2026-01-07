import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GameTemplateItem {
  id: string;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  display_name: string;
  scoring_type: 'rally21' | 'sideout11';
}

interface GameTemplateEditorProps {
  templates: GameTemplateItem[];
  onChange: (templates: GameTemplateItem[]) => void;
  rosterSize: 4 | 6 | 8;
}

const GAME_TYPE_OPTIONS = [
  { value: 'WD', label: 'Đôi Nữ (WD)', description: '2 nữ' },
  { value: 'MD', label: 'Đôi Nam (MD)', description: '2 nam' },
  { value: 'MX', label: 'Đôi Nam Nữ (MX)', description: '1 nam + 1 nữ' },
  { value: 'WS', label: 'Đơn Nữ (WS)', description: '1 nữ' },
  { value: 'MS', label: 'Đơn Nam (MS)', description: '1 nam' },
];

const SCORING_OPTIONS = [
  { value: 'rally21', label: 'Rally 21' },
  { value: 'sideout11', label: 'Sideout 11' },
];

const DEFAULT_TEMPLATES: Record<4 | 6 | 8, GameTemplateItem[]> = {
  4: [
    { id: '1', order_index: 0, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MD', display_name: 'MD', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'WD', display_name: 'WD', scoring_type: 'rally21' },
  ],
  6: [
    { id: '1', order_index: 0, game_type: 'WD', display_name: 'WD', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'MD', display_name: 'MD', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
  ],
  8: [
    { id: '1', order_index: 0, game_type: 'WD', display_name: 'WD 1', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'WD', display_name: 'WD 2', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MD', display_name: 'MD 1', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'MD', display_name: 'MD 2', scoring_type: 'rally21' },
    { id: '5', order_index: 4, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '6', order_index: 5, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
  ],
};

export function getDefaultTemplates(rosterSize: 4 | 6 | 8): GameTemplateItem[] {
  return DEFAULT_TEMPLATES[rosterSize].map(t => ({ ...t }));
}

export function GameTemplateEditor({ templates, onChange, rosterSize }: GameTemplateEditorProps) {
  const addTemplate = () => {
    const newId = Date.now().toString();
    const newTemplate: GameTemplateItem = {
      id: newId,
      order_index: templates.length,
      game_type: 'MX',
      display_name: `Game ${templates.length + 1}`,
      scoring_type: 'rally21',
    };
    onChange([...templates, newTemplate]);
  };

  const removeTemplate = (id: string) => {
    const updated = templates
      .filter(t => t.id !== id)
      .map((t, index) => ({ ...t, order_index: index }));
    onChange(updated);
  };

  const updateTemplate = (id: string, field: keyof GameTemplateItem, value: string) => {
    const updated = templates.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    onChange(updated);
  };

  const moveTemplate = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === templates.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newTemplates = [...templates];
    [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];
    
    onChange(newTemplates.map((t, i) => ({ ...t, order_index: i })));
  };

  const resetToDefault = () => {
    onChange(getDefaultTemplates(rosterSize));
  };

  const isEvenGames = templates.length % 2 === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Các game trong trận đấu</h3>
          <p className="text-sm text-muted-foreground">
            {templates.length} game {isEvenGames && '(số chẵn - có thể cần DreamBreaker)'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDefault}>
          Reset mặc định
        </Button>
      </div>

      <div className="space-y-2">
        {templates.map((template, index) => (
          <Card key={template.id} className="bg-muted/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveTemplate(index, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveTemplate(index, 'down')}
                    disabled={index === templates.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <span className="text-sm font-medium w-8 text-muted-foreground">
                  {index + 1}.
                </span>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select
                    value={template.game_type}
                    onValueChange={(value) => updateTemplate(template.id, 'game_type', value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GAME_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={template.display_name}
                    onChange={(e) => updateTemplate(template.id, 'display_name', e.target.value)}
                    placeholder="Tên hiển thị"
                    className="h-9"
                  />

                  <Select
                    value={template.scoring_type}
                    onValueChange={(value) => updateTemplate(template.id, 'scoring_type', value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORING_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeTemplate(template.id)}
                  disabled={templates.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addTemplate} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Thêm game
      </Button>
    </div>
  );
}
