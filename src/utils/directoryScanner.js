/**
 * Recursively walks a FileSystemDirectoryHandle, yielding {file, relativePath}
 * for each .stl file found.
 */
export async function* scanDirectory(dirHandle, path = '') {
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = path ? `${path}/${name}` : name;
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.stl')) {
      const file = await handle.getFile();
      yield { file, relativePath: fullPath };
    } else if (handle.kind === 'directory') {
      yield* scanDirectory(handle, fullPath);
    }
  }
}

/**
 * Quick scan returning just the count of .stl files in a directory tree.
 * Runs before processing so we can show "Processing 3 of 47".
 */
export async function countSTLFiles(dirHandle, path = '') {
  let count = 0;
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.stl')) {
      count++;
    } else if (handle.kind === 'directory') {
      count += await countSTLFiles(handle);
    }
  }
  return count;
}

/**
 * Wraps a flat FileList into the same AsyncIterable shape used by scanDirectory.
 * Provides backward compatibility for drag-and-drop and file input.
 */
export async function* wrapFileList(fileList) {
  for (const file of fileList) {
    yield { file, relativePath: file.name };
  }
}
