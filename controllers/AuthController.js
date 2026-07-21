import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db.mjs'; // eslint-disable-line import/extensions
import redisClient from '../utils/redis.mjs'; // eslint-disable-line import/extensions

class AuthController {
  static async getConnect(request, response) {
    const authorization = request.header('Authorization') || '';

    if (!authorization.startsWith('Basic ')) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf-8');
    const separator = credentials.indexOf(':');

    if (separator === -1) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const email = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);
    const user = await dbClient.db.collection('users').findOne({
      email,
      password: sha1(password),
    });

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = uuidv4();

    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
    response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await redisClient.del(`auth_${token}`);
    response.status(204).send();
  }
}

export default AuthController;
