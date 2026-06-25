import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(file: string) {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
}

test('Electron keeps VibeX RunningHub SSO inside its session and refreshes embedded frames', () => {
  const main = read('electron/main.cjs');

  assert.match(main, /function\s+isVibeXRhLoginUrl\s*\(/);
  assert.match(main, /function\s+isVibeXSsoCallbackUrl\s*\(/);
  assert.match(main, /function\s+extractVibeXRhLoginTokens\s*\(/);
  assert.match(main, /function\s+readVibeXRhTokensFromSessionCookies\s*\(/);
  assert.match(main, /function\s+persistVibeXRhLoginTokens\s*\(/);
  assert.match(main, /VIBEX_RH_TOKEN_ALIASES/);
  assert.match(main, /accessToken/);
  assert.match(main, /access_token/);
  assert.match(main, /function\s+reloadVibeXFramesAfterLogin\s*\(/);
  assert.match(main, /function\s+configureVibeXRhLoginWindow\s*\(/);
  assert.match(main, /function\s+openVibeXRhLoginWindow\s*\(/);

  assert.match(main, /setWindowOpenHandler\(\(\{\s*url:\s*targetUrl\s*\}\)\s*=>\s*\{[\s\S]*isVibeXRhLoginUrl\(targetUrl\)[\s\S]*action:\s*'allow'/);
  assert.match(main, /did-create-window[\s\S]*isVibeXRhLoginUrl\(details\?\.url\)[\s\S]*configureVibeXRhLoginWindow/);
  assert.match(main, /will-navigate[\s\S]*isVibeXRhLoginUrl\(targetUrl\)[\s\S]*event\.preventDefault\(\)[\s\S]*openVibeXRhLoginWindow\(targetUrl\)/);
  assert.match(main, /will-redirect[\s\S]*isVibeXSsoCallbackUrl\(targetUrl\)[\s\S]*scheduleCallbackSync\(targetUrl,\s*800\)[\s\S]*return;/);
  assert.doesNotMatch(main, /will-redirect[\s\S]*isVibeXSsoCallbackUrl\(targetUrl\)[\s\S]*event\.preventDefault\(\)[\s\S]*scheduleCallbackSync\(targetUrl/);
  assert.match(main, /session\.defaultSession\.cookies\.get\(\{\s*url\s*\}\)/);
  assert.match(main, /session\.defaultSession\.cookies\.set/);
  assert.match(main, /Rh-Accesstoken/);
  assert.match(main, /Domain=\.runninghub\.cn|domain:\s*'\.runninghub\.cn'/);
  assert.match(main, /sameSite:\s*'no_restriction'/);
  assert.match(main, /__t8VibeXRhLoginAttempts/);
  assert.match(main, /localStorage\.setItem\(key,\s*value\)/);
  assert.match(main, /iframe\[data-vibex-frame="true"\]/);
  assert.match(main, /vibex\.runninghub\.cn/);
  assert.match(main, /sso-popup-callback/);
});
