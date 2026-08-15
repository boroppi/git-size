import type { HistoryObject, HistoryReport, RepositoryInfo } from '../types.js';
import { runGit, runGitWithInput } from './command.js';
import { directorySize } from './repository.js';

export async function analyzeHistory(
  repository: RepositoryInfo,
  currentPaths: ReadonlySet<string> = new Set(),
): Promise<HistoryReport> {
  const gitDirectorySize = await directorySize(repository.gitDirectory);
  const countOutput = await runGit(['count-objects', '-v'], repository.path);
  const counts = parseCountObjects(countOutput);

  if (!repository.hasCommits) {
    return {
      gitDirectorySize,
      looseObjects: counts.count,
      looseObjectsSize: counts.size * 1024,
      packedObjects: counts.inPack,
      packedObjectsSize: counts.sizePack * 1024,
      objectCount: counts.count + counts.inPack,
      largestObjects: [],
      notes: ['No commits exist yet, so there are no reachable historical objects to inspect.'],
    };
  }

  const objectListing = await runGit(['rev-list', '--objects', '--all'], repository.path);
  const objectPaths = new Map<string, string>();
  const objectIds: string[] = [];
  const seenObjectIds = new Set<string>();

  for (const line of objectListing.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    const separator = line.indexOf(' ');
    const objectId = separator === -1 ? line : line.slice(0, separator);
    const objectPath = separator === -1 ? undefined : line.slice(separator + 1);
    if (!seenObjectIds.has(objectId)) {
      seenObjectIds.add(objectId);
      objectIds.push(objectId);
    }
    if (objectPath) {
      objectPaths.set(objectId, objectPath);
    }
  }

  const largestObjects = await getLargestObjects(repository.path, objectIds, objectPaths);
  const notes = [
    'Historical filenames are shown only when Git can associate them with reachable objects.',
  ];
  const deletedHistorical = largestObjects.filter(
    (object) => object.path !== undefined && !currentPaths.has(object.path),
  );
  if (deletedHistorical.length > 0) {
    notes.push('Large deleted files may still exist in Git history.');
  } else if (largestObjects.some((object) => object.path !== undefined)) {
    notes.push(
      'A large historical object may represent content that was later replaced in the current working tree.',
    );
  }

  return {
    gitDirectorySize,
    looseObjects: counts.count,
    looseObjectsSize: counts.size * 1024,
    packedObjects: counts.inPack,
    packedObjectsSize: counts.sizePack * 1024,
    objectCount: counts.count + counts.inPack,
    largestObjects,
    notes,
  };
}

interface CountObjects {
  readonly count: number;
  readonly size: number;
  readonly inPack: number;
  readonly sizePack: number;
}

function parseCountObjects(output: string): CountObjects {
  const values = new Map<string, number>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([^:]+):\s*(\d+)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = Number(match[2]);
    if (key !== undefined && Number.isFinite(value)) {
      values.set(key, value);
    }
  }
  return {
    count: values.get('count') ?? 0,
    size: values.get('size') ?? 0,
    inPack: values.get('in-pack') ?? 0,
    sizePack: values.get('size-pack') ?? 0,
  };
}

async function getLargestObjects(
  repositoryRoot: string,
  objectIds: readonly string[],
  objectPaths: ReadonlyMap<string, string>,
): Promise<readonly HistoryObject[]> {
  if (objectIds.length === 0) {
    return [];
  }

  const result = await runGitWithInput(
    ['cat-file', '--batch-check'],
    repositoryRoot,
    `${objectIds.join('\n')}\n`,
  );
  const objects: HistoryObject[] = [];

  for (const line of result.split(/\r?\n/)) {
    const parts = line.split(' ');
    if (parts.length < 3) {
      continue;
    }
    const objectId = parts[0];
    const type = parseObjectType(parts[1]);
    const size = Number(parts[2]);
    if (!objectId || (!type && parts[1] !== 'missing') || !Number.isSafeInteger(size)) {
      continue;
    }
    if (type !== 'blob') {
      continue;
    }
    objects.push({
      objectId,
      path: objectPaths.get(objectId),
      size,
      type,
    });
  }

  return objects
    .sort((a, b) => b.size - a.size || a.objectId.localeCompare(b.objectId))
    .slice(0, 10);
}

function parseObjectType(value: string | undefined): HistoryObject['type'] | undefined {
  if (value === 'blob' || value === 'tree' || value === 'commit' || value === 'tag') {
    return value;
  }
  return value === 'missing' ? 'unknown' : undefined;
}