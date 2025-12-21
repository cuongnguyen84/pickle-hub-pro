import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAdminUsers,
  useUpdateUserRole,
  useAssignUserOrganization,
  useAdminOrganizations,
} from "@/hooks/useAdminData";
import { useI18n } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Building2 } from "lucide-react";

export default function AdminUsers() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: organizations } = useAdminOrganizations();
  const updateRole = useUpdateUserRole();
  const assignOrg = useAssignUserOrganization();

  const handleRoleChange = async (userId: string, role: "viewer" | "creator" | "admin") => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast({ title: "Cập nhật vai trò thành công" });
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Có lỗi xảy ra" });
    }
  };

  const handleOrgChange = async (userId: string, organizationId: string) => {
    try {
      await assignOrg.mutateAsync({
        userId,
        organizationId: organizationId === "none" ? null : organizationId,
      });
      toast({ title: "Cập nhật tổ chức thành công" });
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Có lỗi xảy ra" });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "creator":
        return "default";
      default:
        return "secondary";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return t.admin.user.admin;
      case "creator":
        return t.admin.user.creator;
      default:
        return t.admin.user.viewer;
    }
  };

  const getPrimaryRole = (roles: string[]) => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("creator")) return "creator";
    return "viewer";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t.admin.users}</h1>
          <p className="text-foreground-muted mt-1">Quản lý người dùng và phân quyền</p>
        </div>

        {usersLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>{t.admin.user.email}</TableHead>
                    <TableHead>{t.admin.user.displayName}</TableHead>
                    <TableHead>{t.admin.user.role}</TableHead>
                    <TableHead>{t.admin.user.organization}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: any) => (
                    <TableRow key={user.id} className="border-border">
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.display_name || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={getPrimaryRole(user.roles)}
                          onValueChange={(value) =>
                            handleRoleChange(user.id, value as "viewer" | "creator" | "admin")
                          }
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">{t.admin.user.viewer}</SelectItem>
                            <SelectItem value="creator">{t.admin.user.creator}</SelectItem>
                            <SelectItem value="admin">{t.admin.user.admin}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.organization_id || "none"}
                          onValueChange={(value) => handleOrgChange(user.id, value)}
                          disabled={assignOrg.isPending}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Chọn tổ chức" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Không có</SelectItem>
                            {organizations?.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-foreground-muted mx-auto mb-3" />
              <p className="text-foreground-muted">Chưa có người dùng nào</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
