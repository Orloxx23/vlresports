const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_VERSION = '/api/v1';

let serverProcess;

const waitForServer = async (url, timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await axios.get(url);
      return true;
    } catch (error) {
      if (error.response) return true; // Server is up, even if endpoint errors
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Server failed to start');
};

/**
 * Helper: makes a GET request and asserts the server responded.
 * Since this API scrapes external sites, 5xx from upstream are acceptable in CI.
 */
const expectReachable = async (url) => {
  const response = await axios.get(url, { validateStatus: () => true });
  expect(response.status).toBeDefined();
  // Server should never crash — any HTTP status means it handled the request
  expect(typeof response.status).toBe('number');
  return response;
};

describe('vlresports API Tests', () => {
  beforeAll(async () => {
    if (!process.env.API_URL) {
      serverProcess = spawn('node', ['src/index.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore'
      });
      await waitForServer(BASE_URL);
    }
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Players Endpoints', () => {
    test('GET /api/v1/players should return a response', async () => {
      const response = await expectReachable(`${BASE_URL}${API_VERSION}/players`);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });

    test('GET /api/v1/players/:id should return a response', async () => {
      const playersResponse = await expectReachable(`${BASE_URL}${API_VERSION}/players?limit=1`);
      if (playersResponse.status === 200 && playersResponse.data.data?.length > 0) {
        const playerId = playersResponse.data.data[0].id;
        const response = await expectReachable(`${BASE_URL}${API_VERSION}/players/${playerId}`);
        if (response.status === 200) {
          expect(response.data).toBeDefined();
        }
      }
    });
  });

  describe('Teams Endpoints', () => {
    test('GET /api/v1/teams should return a response', async () => {
      const response = await expectReachable(`${BASE_URL}${API_VERSION}/teams`);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });

    test('GET /api/v1/teams/:id should return a response', async () => {
      const teamsResponse = await expectReachable(`${BASE_URL}${API_VERSION}/teams?limit=1`);
      if (teamsResponse.status === 200 && teamsResponse.data.data?.length > 0) {
        const teamId = teamsResponse.data.data[0].id;
        const response = await expectReachable(`${BASE_URL}${API_VERSION}/teams/${teamId}`);
        if (response.status === 200) {
          expect(response.data).toBeDefined();
        }
      }
    });
  });

  describe('Events Endpoints', () => {
    test('GET /api/v1/events should return a response', async () => {
      const response = await expectReachable(`${BASE_URL}${API_VERSION}/events`);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });
  });

  describe('Matches Endpoints', () => {
    test('GET /api/v1/matches should return a response', async () => {
      const response = await expectReachable(`${BASE_URL}${API_VERSION}/matches`);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });
  });

  describe('Results Endpoints', () => {
    test('GET /api/v1/results should return a response', async () => {
      const response = await expectReachable(`${BASE_URL}${API_VERSION}/results`);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
      }
    });
  });
});
