import request from 'supertest';
import express from 'express';
import router from '../routes.js';

const app = express();
app.use(express.json());
app.use('/api', router);

describe('Instance API', () => {
  it('should create a new instance', async () => {
    const response = await request(app)
      .post('/api/instance/create')
      .send({ instanceId: 'test-instance' })
      .expect(201);

    expect(response.body).toHaveProperty('instanceId', 'test-instance');
  });

  it('should return 400 if instanceId is missing', async () => {
    await request(app)
      .post('/api/instance/create')
      .send({})
      .expect(400);
  });
});