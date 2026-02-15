import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { format } from "date-fns";
import { User } from "lucide-react";

interface ViewerProfile {
  viewerId: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

interface ViewerListTableProps {
  viewers: ViewerProfile[];
  isLoading?: boolean;
}

export function ViewerListTable({ viewers, isLoading }: ViewerListTableProps) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="text-center py-8 text-foreground-muted">
        {t.common.loading}
      </div>
    );
  }

  if (viewers.length === 0) {
    return (
      <div className="text-center py-8 text-foreground-muted">
        {t.admin.viewers.noViewers}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>{t.admin.viewers.viewer}</TableHead>
          <TableHead>{t.admin.user.email}</TableHead>
          <TableHead>{t.admin.viewers.joinedAt}</TableHead>
          <TableHead>{t.admin.viewers.type}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {viewers.map((viewer, index) => (
          <TableRow key={viewer.viewerId}>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={viewer.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">
                  {viewer.displayName ?? t.admin.viewers.anonymous}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-foreground-muted text-sm">
              {viewer.email ?? "—"}
            </TableCell>
            <TableCell className="text-foreground-muted text-sm">
              {format(new Date(viewer.joinedAt), "HH:mm:ss")}
            </TableCell>
            <TableCell>
              {viewer.userId ? (
                <Badge variant="secondary" className="text-xs">
                  {t.admin.viewers.loggedIn}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {t.admin.viewers.anonymous}
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
