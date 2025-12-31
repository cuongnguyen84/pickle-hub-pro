import { useState } from 'react';
import { Bot, HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenName: string;
  stepName: string;
  contextData?: Record<string, any>;
}

// Predefined guidance for each screen/step
const SCREEN_GUIDANCE: Record<string, {
  title: string;
  location: string;
  tasks: string[];
  requirements: string[];
  commonErrors?: string[];
}> = {
  'quick-table-setup/info': {
    title: 'Thông tin giải đấu',
    location: 'Bạn đang ở bước tạo giải mới',
    tasks: [
      'Nhập tên giải / bảng đấu',
      'Nhập số người chơi dự kiến',
      'Chọn có yêu cầu đăng ký trước hay không',
    ],
    requirements: [
      'Tên giải là bắt buộc',
      'Số người chơi tối thiểu là 2',
    ],
    commonErrors: [
      'Quota hết: Mỗi tài khoản chỉ được tạo tối đa số giải theo quota',
    ],
  },
  'quick-table-setup/players': {
    title: 'Nhập danh sách VĐV',
    location: 'Bạn đang ở bước nhập danh sách người chơi',
    tasks: [
      'Nhập tên từng VĐV',
      'Nhập team/CLB (tùy chọn)',
      'Nhập hạt giống nếu có',
      'Chọn phương thức chia bảng (tự động hoặc thủ công)',
    ],
    requirements: [
      'Cần ít nhất 2 VĐV',
      'Tên VĐV là bắt buộc',
    ],
    commonErrors: [
      'Thiếu tên VĐV - hệ thống sẽ bỏ qua dòng trống',
    ],
  },
  'quick-table-view/group': {
    title: 'Xem bảng đấu vòng bảng',
    location: 'Bạn đang xem kết quả chia bảng',
    tasks: [
      'Xem danh sách VĐV theo bảng',
      'Xem lịch thi đấu và sân',
      'Nhập điểm cho các trận đã đấu',
    ],
    requirements: [
      'Điểm phải là số dương',
      'Cần nhập điểm cả 2 bên để lưu kết quả',
    ],
    commonErrors: [
      'Điểm bằng nhau - hệ thống vẫn chấp nhận nhưng BXH sẽ cần xét head-to-head',
    ],
  },
  'quick-table-view/playoff': {
    title: 'Vòng playoff',
    location: 'Bạn đang ở vòng playoff',
    tasks: [
      'Xem nhánh đấu loại trực tiếp',
      'Nhập điểm cho các trận playoff',
      'Theo dõi tiến độ giải',
    ],
    requirements: [
      'Vòng bảng phải hoàn thành trước',
      'Điểm playoff không ảnh hưởng BXH vòng bảng',
    ],
  },
  'registration': {
    title: 'Đăng ký tham dự',
    location: 'Bạn đang ở trang đăng ký tham gia giải',
    tasks: [
      'Nhập tên hiển thị',
      'Chọn hệ thống rating (DUPR, khác, hoặc không có)',
      'Nhập trình độ theo hệ thống đã chọn',
    ],
    requirements: [
      'Tên hiển thị là bắt buộc',
      'Nếu giải yêu cầu trình độ, phải điền đầy đủ',
    ],
    commonErrors: [
      'Đã đăng ký trước đó - hệ thống sẽ hiển thị trạng thái thay vì form',
    ],
  },
  'registration-manager': {
    title: 'Quản lý đăng ký',
    location: 'Bạn đang xem danh sách VĐV đăng ký',
    tasks: [
      'Xem danh sách đăng ký theo trạng thái',
      'Duyệt hoặc từ chối đăng ký',
      'Thêm VĐV đã duyệt vào bảng đấu',
    ],
    requirements: [
      'Phải duyệt đủ số VĐV trước khi chia bảng',
    ],
  },
};

export function AIAssistantDialog({
  open,
  onOpenChange,
  screenName,
  stepName,
  contextData,
}: AIAssistantDialogProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const guidance = SCREEN_GUIDANCE[`${screenName}/${stepName}`] || SCREEN_GUIDANCE[screenName] || {
    title: 'Hướng dẫn',
    location: 'Bạn đang sử dụng hệ thống chia bảng',
    tasks: ['Thực hiện thao tác theo hướng dẫn trên màn hình'],
    requirements: [],
  };

  const suggestedQuestions = [
    'Tôi cần làm gì ở bước này?',
    'Vì sao tôi không bấm tiếp được?',
  ];

  const handleQuestionClick = (question: string) => {
    setSelectedQuestion(question);
  };

  const renderAnswer = () => {
    if (!selectedQuestion) return null;

    return (
      <Card className="mt-4 bg-muted/50">
        <CardContent className="pt-4 space-y-4">
          <div>
            <h4 className="font-medium text-sm text-primary mb-2">📍 Bạn đang ở đâu</h4>
            <p className="text-sm text-foreground-secondary">{guidance.location}</p>
          </div>

          <div>
            <h4 className="font-medium text-sm text-primary mb-2">✅ Việc cần làm ở bước này</h4>
            <ul className="text-sm text-foreground-secondary space-y-1">
              {guidance.tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {task}
                </li>
              ))}
            </ul>
          </div>

          {guidance.requirements.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-primary mb-2">📋 Điều kiện để tiếp tục</h4>
              <ul className="text-sm text-foreground-secondary space-y-1">
                {guidance.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guidance.commonErrors && guidance.commonErrors.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-primary mb-2">⚠️ Lỗi thường gặp</h4>
              <ul className="text-sm text-foreground-secondary space-y-1">
                {guidance.commonErrors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contextData && Object.keys(contextData).length > 0 && (
            <div className="pt-2 border-t border-border">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Dữ liệu hiện tại</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(contextData).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Hỗ trợ
          </DialogTitle>
          <DialogDescription>
            {guidance.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">Chọn câu hỏi:</p>
            <div className="space-y-2">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  variant={selectedQuestion === question ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleQuestionClick(question)}
                >
                  <HelpCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {question}
                </Button>
              ))}
            </div>
          </div>

          {renderAnswer()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
