import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Plus, Copy, Check, Ban, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function AdminApiKeys() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpireDays, setNewKeyExpireDays] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch API keys
  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("api-keys-list");
      if (response.error) throw response.error;
      return response.data.data as ApiKey[];
    },
  });

  // Generate new key mutation
  const generateMutation = useMutation({
    mutationFn: async ({ name, expiresDays }: { name: string; expiresDays?: number }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Call generate function with service role (via edge function)
      const response = await supabase.functions.invoke("api-keys-admin-generate", {
        body: { name, expires_in_days: expiresDays },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key đã được tạo thành công");
    },
    onError: (error) => {
      toast.error("Không thể tạo API key: " + (error as Error).message);
    },
  });

  // Revoke key mutation
  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await supabase.functions.invoke("api-keys-admin-revoke", {
        body: { id: keyId },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key đã bị vô hiệu hóa");
    },
    onError: (error) => {
      toast.error("Không thể vô hiệu hóa: " + (error as Error).message);
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error("Vui lòng nhập tên cho API key");
      return;
    }
    generateMutation.mutate({
      name: newKeyName.trim(),
      expiresDays: newKeyExpireDays ? parseInt(newKeyExpireDays) : undefined,
    });
  };

  const handleCopyKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success("Đã copy API key");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setNewKeyName("");
    setNewKeyExpireDays("");
    setGeneratedKey(null);
    setCopied(false);
  };

  const activeKeys = keys?.filter((k) => k.is_active) || [];
  const revokedKeys = keys?.filter((k) => !k.is_active) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-muted-foreground">
              Quản lý API keys cho các workflow bên ngoài
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            if (!open) handleDialogClose();
            else setCreateDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Tạo API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo API Key mới</DialogTitle>
                <DialogDescription>
                  Tạo một API key mới để sử dụng trong các workflow bên ngoài
                </DialogDescription>
              </DialogHeader>

              {!generatedKey ? (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Tên</Label>
                      <Input
                        id="name"
                        placeholder="vd: n8n-news-workflow"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires">Hết hạn sau (ngày)</Label>
                      <Input
                        id="expires"
                        type="number"
                        placeholder="Để trống = không hết hạn"
                        value={newKeyExpireDays}
                        onChange={(e) => setNewKeyExpireDays(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>
                      Hủy
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? "Đang tạo..." : "Tạo"}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Lưu key này ngay! Bạn sẽ không thể xem lại sau khi đóng dialog.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={generatedKey}
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyKey}
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleDialogClose}>Đã lưu, đóng</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng số keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keys?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Đang hoạt động
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeKeys.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Đã vô hiệu hóa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{revokedKeys.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Keys table */}
        <Card>
          <CardHeader>
            <CardTitle>Danh sách API Keys</CardTitle>
            <CardDescription>
              Tất cả API keys đã được tạo cho project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            ) : !keys?.length ? (
              <div className="text-center py-8">
                <Key className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Chưa có API key nào</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Sử dụng lần cuối</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} className={!key.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {key.key_prefix}...
                        </code>
                      </TableCell>
                      <TableCell>
                        {key.is_active ? (
                          <Badge variant="default" className="bg-green-500">
                            Hoạt động
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Đã vô hiệu</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.last_used_at ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(key.last_used_at), {
                              addSuffix: true,
                              locale: vi,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Chưa sử dụng</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.expires_at ? (
                          format(new Date(key.expires_at), "dd/MM/yyyy")
                        ) : (
                          <span className="text-muted-foreground">Không hết hạn</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(key.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        {key.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Ban className="w-4 h-4 mr-1" />
                                Vô hiệu
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Vô hiệu hóa API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Key "{key.name}" ({key.key_prefix}...) sẽ không thể sử dụng được nữa.
                                  Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => revokeMutation.mutate(key.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Vô hiệu hóa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
