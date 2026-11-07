import { FileResponse } from "../api/explorer.ts";
import CrUri, { Filesystem } from "./uri.ts";

// canCopyMoveTo checks if the files can be copied or moved to the destination.
export function canCopyMoveTo(files: FileResponse[], dst: string, isCopy: boolean): boolean {
  const dstUri = new CrUri(dst);
  const srcUri = new CrUri(files[0].path);
  if (isCopy) {
    if (srcUri.fs() == Filesystem.my && dstUri.fs() == Filesystem.my) {
      return true;
    }
    if (srcUri.fs() == Filesystem.team && dstUri.fs() == Filesystem.team && srcUri.id() == dstUri.id()) {
      return true;
    }
    return false;
  } else {
    switch (srcUri.fs()) {
      case Filesystem.my:
        return dstUri.fs() == Filesystem.my || dstUri.fs() == Filesystem.trash;
      case Filesystem.trash:
        return dstUri.fs() == Filesystem.my;
      case Filesystem.team:
        // v1: only allow move within the same team space
        return dstUri.fs() == Filesystem.team && srcUri.id() == dstUri.id();
    }
  }

  return false;
}
