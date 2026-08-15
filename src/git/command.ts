import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export class GitCommandError extends Error {
  public readonly code: string | number | undefined;
  public readonly stderr: string;

  public constructor(message: string, code: string | number | undefined, stderr = '') {
    super(message);
    this.name = 'GitCommandError';
    this.code = code;
    this.stderr = stderr;
  }
}

export async function runGit(args: readonly string[], cwd: string): Promise<string> {
  try {
    const result = await execFile('git', [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout;
  } catch (error) {
    const failure = error as {
      readonly code?: string | number;
      readonly message?: string;
      readonly stderr?: string;
    };
    throw new GitCommandError(
      failure.message ?? `git ${args.join(' ')} failed`,
      failure.code,
      failure.stderr,
    );
  }
}

export async function runGitWithInput(
  args: readonly string[],
  cwd: string,
  input: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      reject(new GitCommandError(error.message, (error as NodeJS.ErrnoException).code));
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
      } else {
        reject(
          new GitCommandError(
            `git ${args.join(' ')} exited with code ${code ?? 'unknown'}`,
            code ?? undefined,
            Buffer.concat(stderr).toString('utf8'),
          ),
        );
      }
    });

    child.stdin.end(input);
  });
}