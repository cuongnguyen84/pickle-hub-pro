import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface TagFilterProps {
  tags: string[];
  activeTag?: string;
  onSelectTag: (tag: string | undefined) => void;
}

const TagFilter = ({ tags, activeTag, onSelectTag }: TagFilterProps) => {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant={activeTag === tag ? "default" : "secondary"}
          className="cursor-pointer text-xs"
          onClick={() => onSelectTag(activeTag === tag ? undefined : tag)}
        >
          #{tag}
          {activeTag === tag && <X className="w-3 h-3 ml-1" />}
        </Badge>
      ))}
    </div>
  );
};

export default TagFilter;
