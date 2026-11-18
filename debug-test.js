import worker from './worker/index.js';

const env = {
  CHIEF_AI_OPERATOR_KEY: 'operator-fixture',
  OPENAI_API_KEY: 'provider-fixture',
  CHIEF_OPENAI_MODEL: 'fixture-model',
};

const response = await worker.fetch(new Request('https://chief.example/api/chief/provider'), env);
console.log('Status:', response.status);
const body = await response.text();
console.log('Body:', body);
console.log('Contains fixture-model:', body.includes('fixture-model'));
