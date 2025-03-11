// Create test cases using Jest:
const request = require('supertest');
const app = require('../server.js');

describe('Server Endpoints', () => {
    test('GET /home without auth', async () => {
        const res = await request(app).get('/home');
        expect(res.statusCode).toEqual(200);
    });

    test('GET /user without auth', async () => {
        const res = await request(app).get('/user');
        expect(res.statusCode).toEqual(401);
    });

    test('GET /admin with user auth', async () => {
        const res = await request(app)
            .get('/admin')
            .set('Authorization', 'user');
        expect(res.statusCode).toEqual(403);
    });
});
