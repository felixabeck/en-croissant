import { BookOpen, ChessKnight, File, Puzzle, Trophy } from "lucide-react";
import type { FileType } from "./file";

function getFileIcon(type: FileType) {
  switch (type) {
    case "repertoire":
      return BookOpen;
    case "game":
      return ChessKnight;
    case "tournament":
      return Trophy;
    case "puzzle":
      return Puzzle;
    default:
      return File;
  }
}

export function FileIcon({ type, ...props }: { type: FileType } & any) {
  const Icon = getFileIcon(type);
  return <Icon {...props} />;
}
