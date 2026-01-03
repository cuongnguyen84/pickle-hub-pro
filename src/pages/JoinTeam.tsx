import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, Info, Loader2, ArrowRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout';

export default function JoinTeam() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);
  const [tableShareId, setTableShareId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) {
      setPageLoading(false);
      return;
    }

    loadInvitationData();
  }, [inviteCode]);

  const loadInvitationData = async () => {
    if (!inviteCode) return;
    
    setPageLoading(true);
    
    try {
      // Get invitation to find the table
      const { data: invitation } = await supabase
        .from('quick_table_partner_invitations')
        .select('table_id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (invitation?.table_id) {
        // Get table info
        const { data: table } = await supabase
          .from('quick_tables')
          .select('share_id, name')
          .eq('id', invitation.table_id)
          .single();

        if (table) {
          setTableShareId(table.share_id);
          setTableName(table.name);
        }
      }
    } catch (error) {
      console.error('Error loading invitation:', error);
    }
    
    setPageLoading(false);
  };

  const handleGoToTable = () => {
    if (tableShareId) {
      navigate(`/quick/${tableShareId}`);
    } else {
      navigate('/quick');
    }
  };

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">Đang tải...</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-lg py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Luồng ghép đôi đã thay đổi</CardTitle>
            <CardDescription>
              {tableName 
                ? `Giải: ${tableName}`
                : 'Vui lòng mở trang giải để ghép đôi'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Việc ghép đôi giờ đây được thực hiện trực tiếp trong trang giải. 
                Bạn có thể xem danh sách VĐV và bấm "Ghép đôi" để gửi yêu cầu.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Hướng dẫn ghép đôi:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Đăng nhập và mở trang giải</li>
                <li>Đăng ký tham gia (nếu chưa đăng ký)</li>
                <li>Xem danh sách VĐV chưa có partner</li>
                <li>Bấm "Ghép đôi" với VĐV bạn muốn</li>
                <li>Chờ VĐV đó xác nhận</li>
              </ol>
            </div>

            <Button onClick={handleGoToTable} className="w-full" size="lg">
              <ArrowRight className="w-4 h-4 mr-2" />
              {tableShareId ? 'Đến trang giải' : 'Về trang chủ'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
