import { describe, expect, it } from 'vitest';
import { canonicalizeRelayJcsV31 } from './federated-relay-v31.js';

const UPSTREAM = 'cyberphone/json-canonicalization@32a48195b9b20fe67b1795e39e4509f14d860b45';
const vectors = [
  {
    "name": "arrays",
    "input": "[\n  56,\n  {\n    \"d\": true,\n    \"10\": null,\n    \"1\": [ ]\n  }\n]\n",
    "expected": "[56,{\"1\":[],\"10\":null,\"d\":true}]"
  },
  {
    "name": "french",
    "input": "{\n  \"peach\": \"This sorting order\",\n  \"péché\": \"is wrong according to French\",\n  \"pêche\": \"but canonicalization MUST\",\n  \"sin\":   \"ignore locale\"\n}\n",
    "expected": "{\"peach\":\"This sorting order\",\"péché\":\"is wrong according to French\",\"pêche\":\"but canonicalization MUST\",\"sin\":\"ignore locale\"}"
  },
  {
    "name": "structures",
    "input": "{\n  \"1\": {\"f\": {\"f\": \"hi\",\"F\": 5} ,\"\\n\": 56.0},\n  \"10\": { },\n  \"\": \"empty\",\n  \"a\": { },\n  \"111\": [ {\"e\": \"yes\",\"E\": \"no\" } ],\n  \"A\": { }\n}",
    "expected": "{\"\":\"empty\",\"1\":{\"\\n\":56,\"f\":{\"F\":5,\"f\":\"hi\"}},\"10\":{},\"111\":[{\"E\":\"no\",\"e\":\"yes\"}],\"A\":{},\"a\":{}}"
  },
  {
    "name": "unicode",
    "input": "{\n  \"Unnormalized Unicode\":\"A\\u030a\"\n}\n",
    "expected": "{\"Unnormalized Unicode\":\"Å\"}"
  },
  {
    "name": "values",
    "input": "{\n  \"numbers\": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],\n  \"string\": \"\\u20ac$\\u000F\\u000aA'\\u0042\\u0022\\u005c\\\\\\\"\\/\",\n  \"literals\": [null, true, false]\n}",
    "expected": "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\\\\\"/\"}"
  },
  {
    "name": "weird",
    "input": "{\n  \"\\u20ac\": \"Euro Sign\",\n  \"\\r\": \"Carriage Return\",\n  \"\\u000a\": \"Newline\",\n  \"1\": \"One\",\n  \"\\u0080\": \"Control\\u007f\",\n  \"\\ud83d\\ude02\": \"Smiley\",\n  \"\\u00f6\": \"Latin Small Letter O With Diaeresis\",\n  \"\\ufb33\": \"Hebrew Letter Dalet With Dagesh\",\n  \"</script>\": \"Browser Challenge\"\n}\n",
    "expected": "{\"\\n\":\"Newline\",\"\\r\":\"Carriage Return\",\"1\":\"One\",\"</script>\":\"Browser Challenge\",\"\":\"Control\",\"ö\":\"Latin Small Letter O With Diaeresis\",\"€\":\"Euro Sign\",\"😂\":\"Smiley\",\"דּ\":\"Hebrew Letter Dalet With Dagesh\"}"
  }
];

function bytes(value) {
  return Array.from(new TextEncoder().encode(value));
}

describe('federated relay v3.1 RFC8785/JCS reference corpus', () => {
  for (const vector of vectors) {
    it(`matches ${vector.name} byte-for-byte from ${UPSTREAM}`, () => {
      const parsed = JSON.parse(vector.input);
      const actual = canonicalizeRelayJcsV31(parsed);
      expect(bytes(actual)).toEqual(bytes(vector.expected));
    });
  }
});
