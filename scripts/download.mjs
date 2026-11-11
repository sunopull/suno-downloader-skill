
#!/usr/bin/env node
import { mkdir, open, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SITE_ORIGIN = 'https://sunopull.com';
const RESOLVE_URL = new URL('/api/v1/suno/resolve', SITE_ORIGIN);
const SUNO_HOSTS = new Set([
  'suno.com',
  'www.suno.com',
  'suno.ai',
  'www.suno.ai',
]);
const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'wav']);

function parseArgs(args) {
  const options = { outputDir: 'downloads' };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--url' || argument === '--output-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('--'))
        throw new Error(`Expected a value after ${argument}.`);
      index += 1;
      if (argument === '--url') options.url = value;
      else options.outputDir = value;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write(
    [
      'Download one publicly accessible Suno song through SunoPull.',
      '',
      'Usage:',
      '  node scripts/download.mjs --url <suno-song-url> [--output-dir <directory>]',
      '',
      'The original audio format exposed by Suno is preserved.',
      'Files are never overwritten. The default output directory is ./downloads.',
      '',
    ].join('\n')
  );
}

function validateSunoUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Provide a valid public Suno song or share link.');
  }

  if (
    url.protocol !== 'https:' ||
    !SUNO_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('Use a public https://suno.com song or share link.');
}

function safeFilenamePart(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
}

async function readJson(response) {
  return response.json().catch(() => null);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.url)
    throw new Error('Missing --url. Run with --help to see usage.');

  validateSunoUrl(options.url);

  const resolveResponse = await fetch(RESOLVE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: options.url }),
    signal: AbortSignal.timeout(90_000),
  });
  const resolved = await readJson(resolveResponse);
  if (!resolveResponse.ok || resolved?.code !== 0) {
    throw new Error(
      typeof resolved?.message === 'string'
        ? resolved.message
        : `SunoPull could not resolve the link (HTTP ${resolveResponse.status}).`
    );
  }

  const track = resolved.data?.track;
  const file = resolved.data?.file;
  if (
    typeof track?.id !== 'string' ||
    typeof file?.downloadUrl !== 'string' ||
    typeof file?.format !== 'string'
  )
    throw new Error('SunoPull returned an incomplete download result.');

  if (!AUDIO_FORMATS.has(file.format))
    throw new Error('SunoPull returned an unsupported audio format.');

  const downloadUrl = new URL(file.downloadUrl);
  if (
    downloadUrl.origin !== SITE_ORIGIN ||
    !downloadUrl.pathname.startsWith('/api/suno/media/')
  )
    throw new Error('SunoPull returned an unexpected download address.');

  const downloadResponse = await fetch(downloadUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(300_000),
  });
  if (!downloadResponse.ok || !downloadResponse.body) {
    const errorBody = await readJson(downloadResponse);
    throw new Error(
      typeof errorBody?.message === 'string'
        ? errorBody.message
        : `The audio file could not be downloaded (HTTP ${downloadResponse.status}).`
    );
  }

  const title = safeFilenamePart(track.title) || 'Suno song';
  const artist = safeFilenamePart(track.artist);
  const idSuffix = track.id.slice(0, 8);
  const filename = [
    artist ? `${artist} - ` : '',
    title,
    ` [${idSuffix}].${file.format}`,
  ].join('');
  const outputDir = resolve(options.outputDir);
  const outputPath = join(outputDir, filename);

  await mkdir(outputDir, { recursive: true });
  let outputHandle;
  try {
    outputHandle = await open(outputPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST')
      throw new Error(`Refusing to overwrite existing file: ${outputPath}`);
    throw error;
  }
  try {
    await pipeline(
      Readable.fromWeb(downloadResponse.body),
      outputHandle.createWriteStream()
    );
  } catch (error) {
    await outputHandle.close().catch(() => undefined);
    await rm(outputPath, { force: true }).catch(() => undefined);
    if (error?.code === 'EEXIST')
      throw new Error(`Refusing to overwrite existing file: ${outputPath}`);
    throw error;
  }

  process.stdout.write(
    `Downloaded ${track.title || 'Suno song'} to ${outputPath}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `SunoPull download failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
