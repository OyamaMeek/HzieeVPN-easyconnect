export function dingTalkTemporaryCode(event, frameWindow) {
  if (event.origin !== 'https://login.dingtalk.com' || event.source !== frameWindow
      || typeof event.data !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(event.data)) return '';
  return event.data;
}
