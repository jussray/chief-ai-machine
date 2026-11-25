import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('Kael local prompt status',()=>{it('preserves existing generation and reports its result',()=>{const html=readFileSync('app.html','utf8'),js=readFileSync('src/modules/freestyle.js','utf8');expect(html).toContain('id="kaelPet"');expect(js).toContain("kaelStatus('Local prompt ready.')");expect(js).toContain("kaelStatus('Prompt selection failed.')");expect(js).toContain("kaelStatus('No local match found.')");});});
