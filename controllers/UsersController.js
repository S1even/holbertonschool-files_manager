import mongodb from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db.mjs'; // eslint-disable-line import/extensions
import redisClient from '../utils/redis.mjs'; // eslint-disable-line import/extensions

const { ObjectID } = mongodb;

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body || {};

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }

    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    const user = await users.findOne({ email });

    if (user) {
      response.status(400).json({ error: 'Already exist' });
      return;
    }

    const result = await users.insertOne({
      email,
      password: sha1(password),
    });

    response.status(201).json({
      id: result.insertedId.toString(),
      email,
    });
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    if (!userId || !ObjectID.isValid(userId)) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await dbClient.db.collection('users').findOne({
      _id: new ObjectID(userId),
    });

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    response.status(200).json({
      id: user._id.toString(),
      email: user.email,
    });
  }
}

export default UsersController;
