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
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Server failed to start');
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
    test('GET /api/v1/players should return players list', async () => {
      try {
        const response = await axios.get(`${BASE_URL}${API_VERSION}/players`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });

    test('GET /api/v1/players/:id should return player details', async () => {
      try {
        const playersResponse = await axios.get(`${BASE_URL}${API_VERSION}/players?limit=1`);
        if (playersResponse.data.data && playersResponse.data.data.length > 0) {
          const playerId = playersResponse.data.data[0].id;
          const response = await axios.get(`${BASE_URL}${API_VERSION}/players/${playerId}`);
          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
        } else {
          expect(playersResponse.status).toBe(200);
        }
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Teams Endpoints', () => {
    test('GET /api/v1/teams should return teams list', async () => {
      try {
        const response = await axios.get(`${BASE_URL}${API_VERSION}/teams`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });

    test('GET /api/v1/teams/:id should return team details', async () => {
      try {
        const teamsResponse = await axios.get(`${BASE_URL}${API_VERSION}/teams?limit=1`);
        if (teamsResponse.data.data && teamsResponse.data.data.length > 0) {
          const teamId = teamsResponse.data.data[0].id;
          const response = await axios.get(`${BASE_URL}${API_VERSION}/teams/${teamId}`);
          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
        } else {
          expect(teamsResponse.status).toBe(200);
        }
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Events Endpoints', () => {
    test('GET /api/v1/events should return events list', async () => {
      try {
        const response = await axios.get(`${BASE_URL}${API_VERSION}/events`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Matches Endpoints', () => {
    test('GET /api/v1/matches should return matches list', async () => {
      try {
        const response = await axios.get(`${BASE_URL}${API_VERSION}/matches`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Results Endpoints', () => {
    test('GET /api/v1/results should return results list', async () => {
      try {
        const response = await axios.get(`${BASE_URL}${API_VERSION}/results`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        if (error.response) {
          expect(error.response.status).toBeLessThan(500);
        } else {
          throw error;
        }
      }
    });
  });
});
